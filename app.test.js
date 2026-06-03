import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizePet,
  filterPets,
  collectAttributes,
  createPhotoItem,
  petImage,
  layoutLineupItems,
  removeLineupItem,
  readCaughtPets,
  serializeCaughtPets,
  isPetCaught,
  catchPet,
  filterCaughtPets
} from "./public/app.js";

const pets = [
  { id: "001", name: "喵喵", image: "", attributes: ["草"], description: "" },
  { id: "002", name: "火花", attributes: ["火"], description: "火系初始宠物" },
  { id: "003", name: "水蓝蓝", attributes: ["水"], description: "" }
];

test("normalizes missing fields for display", () => {
  assert.deepEqual(normalizePet({ name: "迪莫" }), {
    id: "",
    name: "迪莫",
    image: "",
    attributes: ["未知"],
    description: "暂无简介",
    source: "",
    number: "",
    group: "",
    stats: {}
  });
});

test("filters pets by name keyword and selected attribute", () => {
  assert.deepEqual(filterPets(pets, { query: "水", attribute: "水" }).map((pet) => pet.name), ["水蓝蓝"]);
  assert.deepEqual(filterPets(pets, { query: "水", attribute: "火" }), []);
});

test("collects unique attributes with unknown last", () => {
  const attributes = collectAttributes([...pets, { name: "未知宠物", attributes: [] }]);

  assert.deepEqual(attributes, ["火", "水", "草", "未知"]);
});

test("creates photo items with default position and layer", () => {
  assert.deepEqual(createPhotoItem({ id: "3379" }, 2), {
    petId: "3379",
    x: 46,
    y: 58,
    scale: 1,
    zIndex: 3
  });
});

test("pokedex data uses local image paths for canvas export", () => {
  const payload = JSON.parse(fs.readFileSync("./public/data/pets.json", "utf8"));
  const petsWithImages = payload.pets.filter((pet) => pet.image);

  assert.ok(petsWithImages.length > 100);
  assert.ok(petsWithImages.every((pet) => pet.image.startsWith("./data/images/")));
});

test("pet images disable native browser dragging", () => {
  assert.match(petImage({ name: "糯米剑客", image: "./data/images/3379.png" }), /draggable="false"/);
});

test("lays out two lineup pets centered with light overlap", () => {
  assert.deepEqual(layoutLineupItems([{ petId: "a" }, { petId: "b" }]), [
    { petId: "a", x: 42, y: 64, scale: 1.45, zIndex: 1 },
    { petId: "b", x: 58, y: 64, scale: 1.45, zIndex: 2 }
  ]);
});

test("lays out five full-image lineup pets on one baseline with right-over-left layers", () => {
  const layout = layoutLineupItems(["a", "b", "c", "d", "e"].map((petId) => ({ petId })));

  assert.deepEqual(layout.map((item) => item.x), [22, 36, 50, 64, 78]);
  assert.deepEqual(layout.map((item) => item.y), [64, 64, 64, 64, 64]);
  assert.deepEqual(layout.map((item) => item.zIndex), [1, 2, 3, 4, 5]);
  assert.ok(layout.every((item) => !("clipOffset" in item)));
});

test("removes lineup pet and recomputes ordering", () => {
  const items = ["a", "b", "c"].map((petId, index) => createPhotoItem({ id: petId }, index));

  assert.deepEqual(removeLineupItem(items, "b").map((item) => item.petId), ["a", "c"]);
  assert.deepEqual(layoutLineupItems(removeLineupItem(items, "b")).map((item) => item.x), [42, 58]);
});

test("reads caught pets safely from storage", () => {
  assert.deepEqual(readCaughtPets('["3379","3367",3379,""]'), ["3379", "3367"]);
  assert.deepEqual(readCaughtPets("not-json"), []);
  assert.deepEqual(readCaughtPets(null), []);
});

test("serializes caught pets uniquely", () => {
  assert.equal(serializeCaughtPets(["3379", "3379", 3367, ""]), '["3379","3367"]');
});

test("captures pet by probability without duplicates", () => {
  assert.deepEqual(catchPet(["3379"], "3367", 0.2), {
    caughtIds: ["3379", "3367"],
    success: true,
    alreadyCaught: false
  });
  assert.deepEqual(catchPet(["3379"], "3367", 0.8), {
    caughtIds: ["3379"],
    success: false,
    alreadyCaught: false
  });
  assert.deepEqual(catchPet(["3379"], "3379", 0.99), {
    caughtIds: ["3379"],
    success: true,
    alreadyCaught: true
  });
});

test("filters photo candidates to caught pets only", () => {
  assert.equal(isPetCaught(["001"], "001"), true);
  assert.deepEqual(filterCaughtPets(pets, ["001", "003"]).map((pet) => pet.name), ["喵喵", "水蓝蓝"]);
});
