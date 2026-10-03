import { describe, expect, it } from "vitest";
import { useStore } from "../store/useStore";
import { rebaseLocalScene } from "./rebaseLocalScene";

describe("rebaseLocalScene", () => {
  it("keeps later edits to an addition accepted before its acknowledgement was lost", () => {
    const base = useStore.getState().exportScene();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.items.push({ ...base.items[0], id: 'lost-ack', title: 'Later local title' });
    remote.items.push({ ...base.items[0], id: 'lost-ack', title: 'Accepted title' });
    const result = rebaseLocalScene(base, local, remote);
    expect(result.items.filter(item => item.id === 'lost-ack')).toHaveLength(1);
    expect(result.items.find(item => item.id === 'lost-ack')?.title).toBe('Later local title');
  });
  it("merges different fields on the same item without mutating its inputs", () => {
    const base = useStore.getState().exportScene();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.items[0].title = "Local title";
    remote.items[0].position = [1, 2, 3];
    const result = rebaseLocalScene(base, local, remote);
    expect(result.items[0]).toMatchObject({ title: "Local title", position: [1, 2, 3] });
    expect(remote.items[0].title).toBe(base.items[0].title);
    expect(local.items[0].position).toEqual(base.items[0].position);
  });

  it("retains the unsent local value when the same field changes remotely", () => {
    const base = useStore.getState().exportScene();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.items[0].title = "Local title";
    remote.items[0].title = "Remote title";
    expect(rebaseLocalScene(base, local, remote).items[0].title).toBe("Local title");
  });

  it("preserves local deletions and does not resurrect remotely deleted items", () => {
    const base = useStore.getState().exportScene();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.items[0].title = "Unsent edit";
    local.items.splice(1, 1);
    remote.items.shift();
    const result = rebaseLocalScene(base, local, remote);
    expect(result.items.some(({ id }) => id === base.items[0].id || id === base.items[1].id)).toBe(false);
  });

  it("keeps independent room changes and additions from both editors", () => {
    const base = useStore.getState().exportScene();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.roomSize.width += 1;
    remote.roomSize.length += 2;
    local.items.push({ ...base.items[0], id: "local-new" });
    remote.items.push({ ...base.items[0], id: "remote-new" });
    const result = rebaseLocalScene(base, local, remote);
    expect(result.roomSize).toMatchObject({ width: local.roomSize.width, length: remote.roomSize.length });
    expect(result.items.map(({ id }) => id)).toEqual(expect.arrayContaining(["local-new", "remote-new"]));
  });
});
