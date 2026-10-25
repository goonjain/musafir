import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});

describe("LiveMap Component", () => {
  it("renders LiveMap and alternative destinations without ReferenceError", async () => {
    const React = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { LiveMap } = await import("@/components/musafir/LiveMap");

    const html = renderToString(
      React.createElement(LiveMap, {
        onOptimize: () => {},
        pulseAdj: {},
        reports: [],
        observations: [],
        adminOverrides: {},
      }),
    );

    expect(html).toBeDefined();
    expect(typeof html).toBe("string");
    expect(html).toContain("Amber Fort");
  });
});
