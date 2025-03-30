import { bufferTime, MonoTypeOperatorFunction, scan, OperatorFunction, Subject, tap, map } from "rxjs";

export function bufferAudit<T>(buffer = 10_000, audit: (messages: T[]) => void): MonoTypeOperatorFunction<T> {
  return (source) => {
    const logBuffer = new Subject<T>();

    logBuffer
      .pipe(
        bufferTime(buffer),
        tap((values) => audit(values)),
      )
      .subscribe();

    return source.pipe(tap((value) => logBuffer.next(value)));
  };
}

export function lastN<T>(n: number): OperatorFunction<T, T[]> {
  return scan((acc: any[], value) => {
    const newAcc = [...acc, value];
    if (newAcc.length > n) newAcc.shift();
    return newAcc;
  }, []);
}

export function auditsPerMinute(
  history = 5,
): OperatorFunction<number, { average: number; minutes: number; audits: number[] }> {
  return (source) =>
    source.pipe(
      lastN(history),
      map((audits) => {
        const average = audits.reduce((sum, val) => sum + val, 0) / audits.length;
        return {
          average,
          minutes: audits.length,
          audits,
        };
      }),
    );
}
