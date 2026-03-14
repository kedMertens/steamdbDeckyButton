import {
  ButtonItem,
  staticClasses,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
  afterPatch,
} from "@decky/ui";
import {
  definePlugin,
  routerHook,
} from "@decky/api"
import { FaShip } from "react-icons/fa";

function SteamDBButton() {
  return (
    <ButtonItem
      layout="below"
      onClick={() => console.log("SteamDB clicked")}
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
      (patchArgs: any[], ret?: any) => {
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
