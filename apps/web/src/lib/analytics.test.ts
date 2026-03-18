/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { initGoogleAnalytics } from "./analytics";

describe("initGoogleAnalytics", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.dataLayer = undefined;
    window.gtag = undefined;
  });

  it("does nothing when the measurement id is missing", () => {
    initGoogleAnalytics(undefined);

    expect(document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)).toBeNull();
    expect(window.dataLayer).toBeUndefined();
    expect(window.gtag).toBeUndefined();
  });

  it("loads gtag.js and queues commands using the standard gtag arguments shape", () => {
    const appendChildSpy = vi.spyOn(document.head, "appendChild");

    initGoogleAnalytics("G-TEST123");

    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    const script = document.querySelector(`script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123"]`);
    expect(script).not.toBeNull();
    expect(window.gtag).toBeTypeOf("function");
    expect(window.dataLayer).toHaveLength(2);
    expect(Object.prototype.toString.call(window.dataLayer?.[0])).toBe("[object Arguments]");
    expect(Object.prototype.toString.call(window.dataLayer?.[1])).toBe("[object Arguments]");
    expect(Array.from(window.dataLayer?.[0] as unknown as IArguments)).toEqual(["js", expect.any(Date)]);
    expect(Array.from(window.dataLayer?.[1] as unknown as IArguments)).toEqual(["config", "G-TEST123"]);
  });
});
