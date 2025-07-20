import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility function", () => {
  it("should return empty string when no arguments", () => {
    expect(cn()).toBe("");
  });

  it("should return single class name", () => {
    expect(cn("text-red-500")).toBe("text-red-500");
  });

  it("should merge multiple class names", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("should handle conditional classes", () => {
    expect(cn("base-class", false && "conditional-class")).toBe("base-class");
    expect(cn("base-class", true && "active-class")).toBe("base-class active-class");
  });

  it("should handle undefined and null values", () => {
    expect(cn("valid-class", undefined, null)).toBe("valid-class");
  });

  it("should merge tailwind classes correctly", () => {
    // tailwind-merge should handle conflicting classes
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("should handle array of classes", () => {
    expect(cn(["btn", "btn-primary"])).toBe("btn btn-primary");
  });

  it("should handle object notation", () => {
    expect(cn({ "bg-red-500": true, "bg-blue-500": false })).toBe("bg-red-500");
  });
});