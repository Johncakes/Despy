/**
 * testRunner.ts — WebContainer 내 자동 테스트 실행 + 결과 파싱
 *
 * `npm test`(Vitest)를 WebContainer 안에서 돌리고, Vitest의 JSON 리포터 출력을
 * 도메인 타입(AutoTestResult)으로 변환한다. 풀이 중 학생에게 보여주는 *즉시 피드백*
 * 용도이며, 제출 시점의 공식 점수는 서버(/api/grade) 재실행이 확정한다(§7.2).
 *
 * stdout은 npm 잡음(스크립트 echo 등)과 섞여 파싱이 취약하므로, JSON 리포터를
 * `--outputFile`로 파일에 쓰게 한 뒤 FS에서 읽어 파싱한다(stdout은 콘솔 로그로만 흘림).
 * 형식은 Jest 호환 JSON(testResults[].assertionResults[])이다.
 *
 * 무한 루프·무한 빌드가 탭을 멈추지 않도록 runtime의 타임아웃 가드를 통해 실행한다(§3.4).
 *
 * 레이어 규칙: shared/lib 내부(runtime, utils/logger)와 shared/core/types만 의존한다.
 *
 * 사용처: features/solve/useWorkspace (테스트 실행 버튼 → 결과 패널)
 */
import type { AutoTestResult } from '@/shared/core/types';
import {
  bootWebContainer,
  runCommandWithTimeout,
  type OutputListener,
} from '@/shared/lib/webcontainer/runtime';

// ── Constants ─────────────────────────────────────────────────────────────

/** Vitest JSON 리포터가 결과를 쓰는 파일(워크스페이스 루트 상대 경로). */
const TEST_RESULT_PATH = 'test-results.json';

/** 테스트 실행 최대 허용 시간(ms). 초과 시 kill(무한 루프 가드 — §3.4). */
const DEFAULT_TEST_TIMEOUT_MS = 60_000;

// ── Types ─────────────────────────────────────────────────────────────────

/** Vitest JSON 리포터의 단일 테스트(it/test) 결과 (Jest 호환 형식). */
interface JsonAssertionResult {
  ancestorTitles: string[];
  title: string;
  fullName?: string;
  status: string; // 'passed' | 'failed' | 'skipped' | 'pending' | 'todo'
  failureMessages: string[];
}

/** Vitest JSON 리포터의 테스트 파일 단위 결과. */
interface JsonTestFileResult {
  name: string;
  status: string; // 'passed' | 'failed'
  message?: string;
  assertionResults: JsonAssertionResult[];
}

/** Vitest JSON 리포터 전체 보고서(필요한 필드만). */
interface JsonTestReport {
  testResults: JsonTestFileResult[];
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * 테스트를 실행하고 결과를 AutoTestResult로 반환한다.
 *
 * args에는 npm 스크립트 기준 인자를 넘긴다(예: `['test']`). 내부에서 npm passthrough
 * (`--`) 뒤에 JSON 리포터 + outputFile 플래그를 덧붙여 실행한다
 * (예: `npm test -- --reporter=json --outputFile=test-results.json`, §3.1).
 *
 * @throws 타임아웃·결과 파일 부재·JSON 파싱 실패 시 설명 메시지와 함께 throw.
 *   테스트가 일부 실패(exit≠0)한 것은 정상 흐름이므로 throw하지 않는다.
 */
export async function runTests(
  command: string,
  args: string[],
  onOutput?: OutputListener,
): Promise<AutoTestResult> {
  const spawnArgs = [...args, '--', '--reporter=json', `--outputFile=${TEST_RESULT_PATH}`];
  const { timedOut } = await runCommandWithTimeout(command, spawnArgs, {
    onOutput,
    timeoutMs: DEFAULT_TEST_TIMEOUT_MS,
  });

  if (timedOut) {
    throw new Error(
      `테스트가 제한 시간(${DEFAULT_TEST_TIMEOUT_MS / 1000}초) 안에 끝나지 않아 중단했습니다. ` +
        '무한 루프가 없는지 확인하세요.',
    );
  }

  // exit 코드가 0이 아니어도(테스트 실패) 리포트는 정상 생성되므로 파일을 읽어 파싱한다.
  const report = await readReport();
  return toAutoTestResult(report);
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

/** 결과 파일을 FS에서 읽어 JSON으로 파싱한다. 없거나 깨졌으면 설명 메시지로 throw. */
async function readReport(): Promise<JsonTestReport> {
  const container = await bootWebContainer();

  let raw: string;
  try {
    raw = await container.fs.readFile(TEST_RESULT_PATH, 'utf-8');
  } catch {
    throw new Error(
      '테스트 결과 파일을 찾을 수 없습니다. 테스트 실행 자체가 실패했을 수 있습니다(콘솔 로그 확인).',
    );
  }

  try {
    return JSON.parse(raw) as JsonTestReport;
  } catch {
    throw new Error('테스트 결과(JSON) 파싱에 실패했습니다.');
  }
}

/** Jest 호환 JSON 보고서를 도메인 타입(AutoTestResult)으로 변환한다. */
function toAutoTestResult(report: JsonTestReport): AutoTestResult {
  const files = report.testResults ?? [];

  const cases = files.flatMap((file) => {
    // 테스트 파일이 컴파일/로드 단계에서 실패하면 개별 케이스 없이 파일 자체가 실패한다.
    if (file.assertionResults.length === 0 && file.status === 'failed') {
      return [
        {
          name: file.name,
          passed: false,
          message: file.message || '테스트 파일을 실행하지 못했습니다.',
        },
      ];
    }

    return file.assertionResults.map((assertion) => {
      const name =
        [...assertion.ancestorTitles, assertion.title].filter(Boolean).join(' › ') ||
        assertion.fullName ||
        assertion.title;
      const passed = assertion.status === 'passed';
      return {
        name,
        passed,
        message: passed ? undefined : assertion.failureMessages.join('\n') || undefined,
      };
    });
  });

  return {
    passedCount: cases.filter((testCase) => testCase.passed).length,
    totalCount: cases.length,
    cases,
  };
}
