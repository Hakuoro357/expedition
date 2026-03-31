export class AnalyticsService {
  track(eventName: string, payload?: Record<string, unknown>): void {
    console.info("[analytics]", eventName, payload ?? {});
  }
}

