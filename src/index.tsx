import {
  ButtonItem,
  Focusable,
  staticClasses,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
  afterPatch,
  Navigation,
  findModuleExport,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
  fetchNoCors,
} from "@decky/api";
import { FaDollarSign, FaExternalLinkAlt, FaShip } from "react-icons/fa";

function getSteamDbPriceHistoryUrl(appId: string): string {
  const parsed = Number(appId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid appid");
  }
  return `https://steamdb.info/app/${parsed}/#pricehistory`;
}

function SteamDBButton() {
  const appId = typeof window !== "undefined" ? window.location.pathname.match(/\/app\/(\d+)(?:\/|$)/)?.[1] : null;

  if (!appId) return null;

  return (
    <div
      onClick={() => Navigation.NavigateToExternalWeb(getSteamDbPriceHistoryUrl(appId))}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 16px",
        borderRadius: "6px",
        background: "#5ba32b",
        border: "1px solid #5ba32b",
        color: "#ffffff",
        fontWeight: 600,
        fontSize: "12px",
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#5ba32b")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#5ba32b")}
    >
      <FaDollarSign style={{ fontSize: "14px" }} />
      <span>SteamDB</span>
      <FaExternalLinkAlt style={{ fontSize: "12px", opacity: 0.5 }} />
    </div>
  );
}

function LibrarySteamDBButton() {
  const appId = typeof window !== "undefined" ? window.location.pathname.match(/\/app\/(\d+)(?:\/|$)/)?.[1] : null;

  if (!appId) return null;

  return (
    <Focusable style={{ display: "flex", justifyContent: "flex-end", width: "100%" }} flow-children="row">
      <SteamDBButton />
    </Focusable>
  );
}

function SettingsPanel() {
  return (
    <div style={{ padding: "16px" }}>
      <ButtonItem
        layout="below"
        onClick={() => console.log("Clicked!")}
      >
        Enable Feature
      </ButtonItem>
    </div>
  );
}

const STORE_HOST = "store.steampowered.com";
const STORE_BUTTON_ID = "steamdb-store-button";
const STORE_DEBUGGER_TABS_URL = "http://localhost:8080/json";

type DebugTab = { url: string; webSocketDebuggerUrl?: string };
type HistoryLike = {
  location?: { pathname?: string };
  listen: (listener: (location: unknown) => void) => () => void;
};

const StoreHistoryModule = findModuleExport((exp: any) => exp?.m_history !== undefined) as
  | { m_history?: HistoryLike }
  | undefined;
const StoreHistory = StoreHistoryModule?.m_history;

let storeMounted = false;
let storeAppId = "";
let storeRuntimeReady = false;
let storeWebSocket: WebSocket | null = null;
let storeMessageId = 1;

function storeEvaluate(script: string) {
  if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN || !storeRuntimeReady) {
    return;
  }

  storeWebSocket.send(
    JSON.stringify({
      id: storeMessageId++,
      method: "Runtime.evaluate",
      params: { expression: script },
    }),
  );
}

function storeRemoveButton() {
  storeEvaluate(
    `(function(){const node=document.getElementById('${STORE_BUTTON_ID}');if(node){node.remove();}})();`,
  );
}

function storeGetPosition() {
  return "bottom: 20px; left: 50%; transform: translateX(-50%);";
}

function storeInjectButton(appId: string) {
  let url: string;
  try {
    url = getSteamDbPriceHistoryUrl(appId);
  } catch {
    storeRemoveButton();
    return;
  }

  const script = `
    (function(){
      const existing=document.getElementById('${STORE_BUTTON_ID}');
      if(existing){existing.remove();}
      const wrapper=document.createElement('div');
      wrapper.id='${STORE_BUTTON_ID}';
      wrapper.style.cssText='position:fixed;z-index:999999;${storeGetPosition()}';
      const button=document.createElement('button');
      button.type='button';
      button.innerHTML='<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 16px;border-radius:6px;background:#5ba32b;border:1px solid #5ba32b;color:#ffffff;font-weight:600;font-size:12px;cursor:pointer;transition:background 0.15s ease;"><span style="font-size:14px;">$</span><span>SteamDB</span><span style="font-size:12px;opacity:0.5;">↗</span></span>';
      button.style.cssText='all:unset;display:inline-block;cursor:pointer;';
      const chip=button.firstElementChild;
      if(chip){chip.addEventListener('mouseenter',function(){chip.style.background='#5ba32b';});chip.addEventListener('mouseleave',function(){chip.style.background='#5ba32b';});}
      button.onclick=function(){window.open('${url}','_blank');};
      wrapper.appendChild(button);
      document.body.appendChild(wrapper);
    })();
  `;

  storeEvaluate(script);
}

function storeSyncButtonWithUrl(url: string) {
  const appId = url.includes(STORE_HOST) ? url.match(/\/app\/(\d+)(?:\/|$)/)?.[1] ?? "" : "";
  storeAppId = appId;

  if (!appId) {
    storeRemoveButton();
    return;
  }

  storeInjectButton(appId);
}

async function storeConnectToDebugger(retries = 3): Promise<void> {
  if (!storeMounted || retries <= 0) return;

  try {
    const response = await fetchNoCors(STORE_DEBUGGER_TABS_URL);
    if (!response.ok) throw new Error("debugger tabs unavailable");

    const tabs = (await response.json()) as DebugTab[];
    const storeTab = tabs.find((tab) => tab.url.includes(STORE_HOST) && tab.webSocketDebuggerUrl);
    if (!storeTab?.webSocketDebuggerUrl) {
      setTimeout(() => void storeConnectToDebugger(retries - 1), 1000);
      return;
    }

    storeSyncButtonWithUrl(storeTab.url);

    storeWebSocket = new WebSocket(storeTab.webSocketDebuggerUrl);
    storeWebSocket.onopen = (event: Event) => {
      const socket = event.target;
      if (!(socket instanceof WebSocket)) return;

      socket.send(JSON.stringify({ id: storeMessageId++, method: "Page.enable" }));
      socket.send(JSON.stringify({ id: storeMessageId++, method: "Runtime.enable" }));

      setTimeout(() => {
        storeRuntimeReady = true;
        if (storeAppId) storeInjectButton(storeAppId);
      }, 250);
    };

    storeWebSocket.onmessage = (event: MessageEvent<string>) => {
      if (!storeMounted) return;

      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>;
        if (payload.method !== "Page.frameNavigated") return;

        const params = payload.params as Record<string, unknown> | undefined;
        const frame = params?.frame as Record<string, unknown> | undefined;
        const frameUrl = typeof frame?.url === "string" ? frame.url : "";
        if (!frameUrl) return;

        setTimeout(() => storeSyncButtonWithUrl(frameUrl), 350);
      } catch {
        // ignore
      }
    };

    storeWebSocket.onclose = () => {
      storeRuntimeReady = false;
      storeWebSocket = null;
      if (storeMounted) setTimeout(() => void storeConnectToDebugger(), 1000);
    };

    storeWebSocket.onerror = () => {
      if (storeMounted) setTimeout(() => void storeConnectToDebugger(), 1000);
    };
  } catch {
    if (storeMounted) setTimeout(() => void storeConnectToDebugger(retries - 1), 1000);
  }
}

function storeDisconnectDebugger() {
  storeRemoveButton();
  storeMounted = false;
  storeAppId = "";
  storeRuntimeReady = false;
  if (storeWebSocket) {
    storeWebSocket.close();
    storeWebSocket = null;
  }
}

function storeHandlePathChange(pathname: string) {
  if (pathname === "/steamweb") {
    if (!storeMounted) {
      storeMounted = true;
      void storeConnectToDebugger();
    } else if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) {
      void storeConnectToDebugger();
    }
    return;
  }

  if (storeMounted) {
    storeDisconnectDebugger();
  }
}

export default definePlugin(() => {
  const libraryRoutePatch = routerHook.addPatch("/library/app/:appid", (tree: any) => {
    const routeProps = findInReactTree(tree, (x: any) => x?.renderFunc);
    if (!routeProps) return tree;

    const patchHandler = createReactTreePatcher(
      [
        (innerTree: any) =>
          findInReactTree(innerTree, (x: any) => x?.props?.children?.props?.overview)?.props?.children,
      ],
      (_: any[], ret?: any) => {
        const container = findInReactTree(
          ret,
          (x: any) =>
            Array.isArray(x?.props?.children) &&
            x?.props?.className?.includes(appDetailsClasses.InnerContainer),
        );
        if (!container || !Array.isArray(container.props.children)) return ret;
        const alreadyPatched = container.props.children.some(
          (child: any) => child?.props?.["data-steamdb-button"] === "true",
        );
        if (!alreadyPatched) {
          container.props.children.splice(
            1,
            0,
            <div
              key="steamdb-button-wrap"
              data-steamdb-button="true"
              style={{ position: "absolute", top: "60px", right: "20px", zIndex: 20 }}
            >
              <LibrarySteamDBButton key="steamdb-button" />
            </div>,
          );
        }
        return ret;
      },
    );

    afterPatch(routeProps, "renderFunc", patchHandler);
    return tree;
  });

  let stopStoreWatcher = () => {};
  if (StoreHistory) {
    storeHandlePathChange(StoreHistory.location?.pathname || window.location.pathname);
    const unlisten = StoreHistory.listen((location: unknown) => {
      const pathname =
        typeof location === "object" && location !== null && "pathname" in location
          ? String((location as { pathname?: unknown }).pathname ?? "")
          : "";
      if (pathname) storeHandlePathChange(pathname);
    });

    setTimeout(() => storeHandlePathChange(window.location.pathname), 250);

    stopStoreWatcher = () => {
      unlisten();
      storeDisconnectDebugger();
    };
  }

  return {
    name: "steamdbDeckyPlugin",
    title: <div className={staticClasses.Title}>SteamDB Button</div>,
    icon: <FaShip />,
    content: <SettingsPanel />,
    onDismount() {
      routerHook.removePatch("/library/app/:appid", libraryRoutePatch);
      stopStoreWatcher();
    },
  };
});
