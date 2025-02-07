import { bufferTime, MonoTypeOperatorFunction, Subject, tap } from "rxjs";

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
