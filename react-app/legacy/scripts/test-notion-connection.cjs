const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const projectRoot = path.resolve(__dirname, "..");

function loadTs(relativeFile) {
  const source = fs.readFileSync(path.join(projectRoot, relativeFile), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const module = { exports: {} };
  function localRequire(id) {
    if (id === "./notionIds") return loadTs("src/utils/notionIds.ts");
    if (id === "@capacitor/core") {
      return {
        Capacitor: { isNativePlatform: () => false },
        CapacitorHttp: { request: async () => ({ status: 500, data: {} }) }
      };
    }
    return require(id);
  }
  new Function("require", "exports", "module", output)(localRequire, module.exports, module);
  return module.exports;
}

const {
  buildNotionHeaders,
  checkLifeLogNotionDatabaseSchemas,
  createLifeLogNotionDatabases,
  getConnectionErrorMessage,
  repairLifeLogNotionDatabaseSchemas,
  testNotionConnection
} = loadTs("src/utils/notionClient.ts");

const baseSettings = {
  enabled: true,
  mode: "manual-token",
  token: "secret_test",
  workspaceName: "",
  workspaceBotName: "",
  parentPageId: "page_parent",
  peopleDatabaseId: "11111111-1111-1111-1111-111111111111",
  placesDatabaseId: "",
  memoriesDatabaseId: "",
  plansDatabaseId: "",
  apiVersion: "2022-06-28"
};

let failures = 0;

function assert(condition, label, detail) {
  if (condition) return;
  failures += 1;
  console.error(`[${label}] ${detail || "assertion failed"}`);
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    }
  };
}

async function run() {
  let calls = [];
  const missing = await testNotionConnection({ ...baseSettings, token: "" }, async () => {
    calls.push("unexpected");
    return response(200, {});
  });
  assert(!missing.ok && missing.errorKind === "missing-token", "missing-token", JSON.stringify(missing));
  assert(calls.length === 0, "missing-token fetch", `expected no fetch, got ${calls.length}`);

  calls = [];
  const success = await testNotionConnection(baseSettings, async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/users/me")) {
      return response(200, {
        name: "LifeLog Bot",
        bot: { workspace_name: "Test Space" }
      });
    }
    if (url.includes("/databases/")) {
      return response(200, {
        title: [{ plain_text: "LifeLog People" }]
      });
    }
    return response(404, {});
  });
  assert(success.ok, "success", JSON.stringify(success));
  assert(success.workspaceName === "Test Space", "workspace", JSON.stringify(success));
  assert(success.databases.length === 1 && success.databases[0].title === "LifeLog People", "database probe", JSON.stringify(success.databases));
  assert(calls[0].init.headers.Authorization === "Bearer secret_test", "auth header", JSON.stringify(calls[0].init.headers));
  assert(calls[0].init.headers["Notion-Version"] === "2022-06-28", "version header", JSON.stringify(calls[0].init.headers));
  assert(calls[1].url.endsWith("/databases/11111111111111111111111111111111"), "database id normalized", calls[1].url);

  const forbidden = await testNotionConnection(baseSettings, async (url) => {
    if (url.endsWith("/users/me")) return response(200, { name: "Bot", bot: {} });
    return response(403, { message: "Insufficient permissions." });
  });
  assert(!forbidden.ok && forbidden.errorKind === "forbidden", "forbidden database", JSON.stringify(forbidden));
  assert(forbidden.databases[0].message.includes("Insufficient permissions"), "forbidden message", forbidden.databases[0].message);

  const unauthorized = getConnectionErrorMessage(401, {});
  assert(unauthorized.errorKind === "unauthorized" && unauthorized.message.includes("Token"), "unauthorized parse", JSON.stringify(unauthorized));

  const missingDb = getConnectionErrorMessage(404, {});
  assert(missingDb.errorKind === "not-found" && missingDb.message.includes("数据库"), "not found parse", JSON.stringify(missingDb));

  const network = await testNotionConnection(baseSettings, async () => {
    throw new Error("fetch failed");
  });
  assert(!network.ok && network.errorKind === "network", "network failure", JSON.stringify(network));
  assert(network.diagnostic?.path === "/users/me", "network diagnostic path", JSON.stringify(network.diagnostic));
  assert(network.diagnostic?.errorMessage?.includes("fetch failed"), "network diagnostic message", JSON.stringify(network.diagnostic));
  assert(network.diagnostic?.hint?.includes("Web 端直连"), "network diagnostic hint", JSON.stringify(network.diagnostic));

  const headers = buildNotionHeaders({ token: "  secret_trim  ", apiVersion: "" });
  assert(headers.Authorization === "Bearer secret_trim", "header token trim", JSON.stringify(headers));
  assert(headers["Notion-Version"] === "2022-06-28", "header version fallback", JSON.stringify(headers));

  calls = [];
  const create = await createLifeLogNotionDatabases(
    {
      ...baseSettings,
      peopleDatabaseId: "",
      placesDatabaseId: "",
      memoriesDatabaseId: "",
      plansDatabaseId: ""
    },
    async (url, init) => {
      calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
      if (url.includes("/pages/page_parent")) return response(200, { id: "page_parent" });
      if (url.endsWith("/databases")) return response(200, { id: `created_${calls.length}` });
      return response(404, {});
    }
  );
  assert(create.ok && create.databases.length === 4, "auto create success", JSON.stringify(create));
  assert(create.settingsPatch.peopleDatabaseId === "created_2", "auto create people id", JSON.stringify(create.settingsPatch));
  assert(calls.filter((call) => call.url.endsWith("/databases")).length === 4, "auto create calls", JSON.stringify(calls));
  const firstCreateBody = calls.find((call) => call.url.endsWith("/databases")).body;
  assert(firstCreateBody.parent.page_id === "page_parent", "auto create parent", JSON.stringify(firstCreateBody.parent));
  assert(firstCreateBody.properties["名称"].title, "auto create title property", JSON.stringify(firstCreateBody.properties["名称"]));
  assert(firstCreateBody.properties["关系"].select, "auto create chinese property", JSON.stringify(firstCreateBody.properties));

  const parentBlocked = await createLifeLogNotionDatabases(baseSettings, async (url) => {
    if (url.includes("/pages/page_parent")) return response(404, { message: "Could not find page." });
    return response(200, {});
  });
  assert(!parentBlocked.ok && parentBlocked.message.includes("父页面"), "auto create parent blocked", JSON.stringify(parentBlocked));
  assert(parentBlocked.diagnostic?.status === 404, "auto create parent diagnostic status", JSON.stringify(parentBlocked.diagnostic));
  assert(parentBlocked.diagnostic?.path === "/pages/page_parent", "auto create parent diagnostic path", JSON.stringify(parentBlocked.diagnostic));

  const schemaCheck = await checkLifeLogNotionDatabaseSchemas(baseSettings, async (url) => {
    if (url.includes("/databases/11111111111111111111111111111111")) {
      return response(200, {
        title: [{ plain_text: "LifeLog 人物" }],
        properties: {
          名称: { type: "title" },
          "LifeLog ID": { type: "rich_text" },
          关系: { type: "select" }
        }
      });
    }
    return response(404, { message: "unexpected url" });
  });
  assert(schemaCheck.repairable, "schema repairable", JSON.stringify(schemaCheck));
  assert(schemaCheck.databases[0].missing.some((issue) => issue.propertyName === "生日"), "schema missing birthday", JSON.stringify(schemaCheck.databases[0]));
  assert(schemaCheck.message.includes("缺失字段"), "schema missing message", schemaCheck.message);

  const conflictCheck = await checkLifeLogNotionDatabaseSchemas(baseSettings, async (url) => {
    if (url.includes("/databases/11111111111111111111111111111111")) {
      return response(200, {
        title: [{ plain_text: "LifeLog 人物" }],
        properties: {
          名称: { type: "rich_text" },
          "LifeLog ID": { type: "rich_text" }
        }
      });
    }
    return response(404, { message: "unexpected url" });
  });
  assert(conflictCheck.databases[0].conflicts[0]?.propertyName === "名称", "schema conflict property", JSON.stringify(conflictCheck.databases[0]));
  assert(conflictCheck.databases[0].conflicts[0]?.expectedType === "title", "schema conflict expected", JSON.stringify(conflictCheck.databases[0]));

  const repairCalls = [];
  let repaired = false;
  const repair = await repairLifeLogNotionDatabaseSchemas(baseSettings, async (url, init) => {
    repairCalls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    if (url.includes("/databases/11111111111111111111111111111111") && init.method === "GET") {
      return response(200, {
        title: [{ plain_text: "LifeLog 人物" }],
        properties: repaired
          ? {
              名称: { type: "title" },
              "LifeLog ID": { type: "rich_text" },
              关系: { type: "select" },
              生日: { type: "date" },
              重点关注: { type: "checkbox" },
              喜好档案: { type: "rich_text" },
              禁忌雷区: { type: "rich_text" },
              备注: { type: "rich_text" },
              更新时间: { type: "date" }
            }
          : {
              名称: { type: "title" },
              "LifeLog ID": { type: "rich_text" }
            }
      });
    }
    if (url.includes("/databases/11111111111111111111111111111111") && init.method === "PATCH") {
      repaired = true;
      return response(200, { id: "11111111111111111111111111111111" });
    }
    return response(404, { message: "unexpected url" });
  });
  const patchCall = repairCalls.find((call) => call.init.method === "PATCH");
  assert(repair.repaired > 0, "schema repair count", JSON.stringify(repair));
  assert(Boolean(patchCall), "schema repair patch called", JSON.stringify(repairCalls));
  assert(patchCall.body.properties["生日"].date, "schema repair patch body", JSON.stringify(patchCall.body));
  assert(!patchCall.body.properties["名称"], "schema repair keeps existing fields", JSON.stringify(patchCall.body));

  if (failures) {
    console.error(`Notion connection regression failed: ${failures} mismatch(es).`);
    process.exit(1);
  }

  console.log("Notion connection regression passed: missing token, success, permission, 404 and network cases.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
