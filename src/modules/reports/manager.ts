import { filter, Observable, shareReplay, Subscription } from "rxjs";
import hash_sum from "hash-sum";

import { Session } from "../../relay/session.js";
import SuperMap from "../../helpers/super-map.js";

// open query messages (id, type, args)
export type QueryOpen<Args extends Record<string, any>> = ["QRY", "OPEN", string, string, Args];
// close query message (id)
export type QueryClose = ["QRY", "CLOSE", string];

// error messages (id, message)
export type QueryError = ["QRY", "ERR", string, string];
// result message (id, data)
export type QueryData<Result extends unknown> = ["QRY", "DATA", string, Result];

// report type
export type Report<Args extends Record<string, any>, Output> = (
  args: Args,
) => Promise<Observable<Output>> | Observable<Output>;

/** A report manager designed to be created for each websocket connection */
export default class ReportManager {
  types = new Map<string, Report<any, any>>();
  protected reports = new SuperMap<Report<any, any>, Map<string, Observable<any>>>(() => new Map());

  constructor(public session: Session) {
    this.session
      .pipe(filter((v) => Array.isArray(v) && v[0] === "QRY" && v[1]))
      .subscribe(this.handleMessage.bind(this));
  }

  registerType(name: string, report: Report<any, any>) {
    if (this.types.has(name)) throw new Error("A report type with that name already exists");
    this.types.set(name, report);
  }
  unregisterType(name: string) {
    this.types.delete(name);
  }

  /** Create or run a report */
  async execute<Args extends Record<string, any>, Output>(
    report: string | Report<Args, Output>,
    args: Args,
  ): Promise<Observable<Output>> {
    let type = typeof report === "string" ? this.types.get(report) : report;
    if (!type) throw new Error("Failed to find report type");

    const reports = this.reports.get(type);
    const key = hash_sum(args);

    let observable: Observable<Output> | undefined = reports.get(key);
    if (!observable) {
      // create new report
      observable = (await type(args)).pipe(shareReplay());
      reports.set(key, observable);
    }

    return observable;
  }

  subscriptions = new Map<string, Subscription>();
  handleMessage(message: QueryOpen<any> | QueryClose) {
    try {
      switch (message[1]) {
        case "OPEN":
          this.openSub(message[2], message[3], message[4]);
          break;
        case "CLOSE":
          this.closeSub(message[2]);
          break;
      }
    } catch (error) {
      // failed to handle message, ignore
    }
  }

  protected async openSub(id: string, type: string, args: any) {
    const sub = (await this.execute(type, args)).subscribe({
      next: (result) => this.session.send(["QRY", "DATA", id, result] satisfies QueryData<any>),
      error: (err) => {
        if (err instanceof Error) this.session.send(["QRY", "ERR", id, err.message] satisfies QueryError);
        else this.session.send(["QRY", "ERR", id, "Something went wrong"] satisfies QueryError);
      },
      complete: () => this.session.send(["QRY", "CLOSE", id] satisfies QueryClose),
    });

    this.subscriptions.set(id, sub);

    return sub;
  }
  protected closeSub(id: string) {
    const sub = this.subscriptions.get(id);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(id);
    }
  }
}
