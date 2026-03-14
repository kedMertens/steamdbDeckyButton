import {
  ButtonItem,
  staticClasses,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
  afterPatch,
  Navigation,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api";
import { FaShip } from "react-icons/fa";

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
    <ButtonItem
      layout="below"
      onClick={() => {
        const url = getSteamDbPriceHistoryUrl(appId);
        Navigation.NavigateToExternalWeb(url);
      }}
    >
      SteamDB
    </ButtonItem>
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

export default definePlugin(() => {
  const patch = routerHook.addPatch("/library/app/:appid", (tree: any) => {
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
          container.props.children.splice(1, 0, <SteamDBButton key="steamdb-button" />);
        }
        return ret;
      },
    );

    afterPatch(routeProps, "renderFunc", patchHandler);
    return tree;
  });

  return {
    name: "steamdbDeckyPlugin",
    title: <div className={staticClasses.Title}>SteamDB Button</div>,
    icon: <FaShip />,
    content: <SettingsPanel />,
    onDismount() {
      routerHook.removePatch("/library/app/:appid", patch);
    },
  };
});
