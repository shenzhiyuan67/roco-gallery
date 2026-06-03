export function normalizePet(pet) {
  const attributes = Array.isArray(pet.attributes)
    ? pet.attributes.filter(Boolean)
    : typeof pet.attributes === "string" && pet.attributes.trim()
      ? pet.attributes.split(/[、,\s]+/).filter(Boolean)
      : [];

  return {
    id: pet.id || "",
    name: pet.name || "未命名宠物",
    image: pet.image || "",
    attributes: attributes.length ? attributes : ["未知"],
    description: pet.description || "暂无简介",
    source: pet.source || "",
    number: pet.number || "",
    group: pet.group || "",
    stats: pet.stats || {}
  };
}

export function filterPets(pets, filters = {}) {
  const query = (filters.query || "").trim().toLowerCase();
  const attribute = filters.attribute || "全部";

  return pets
    .map(normalizePet)
    .filter((pet) => {
      const matchesQuery = !query || [pet.name, pet.id, pet.number, pet.description]
        .join(" ")
        .toLowerCase()
        .includes(query);
      const matchesAttribute = attribute === "全部" || pet.attributes.includes(attribute);

      return matchesQuery && matchesAttribute;
    });
}

function uniqueIds(ids) {
  return [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
}

export function readCaughtPets(storageValue) {
  if (!storageValue) return [];
  try {
    const parsed = JSON.parse(storageValue);
    return Array.isArray(parsed) ? uniqueIds(parsed) : [];
  } catch {
    return [];
  }
}

export function serializeCaughtPets(ids) {
  return JSON.stringify(uniqueIds(ids));
}

export function isPetCaught(caughtIds, petId) {
  return uniqueIds(caughtIds).includes(String(petId));
}

export function catchPet(caughtIds, petId, roll, successRate = 0.6) {
  const ids = uniqueIds(caughtIds);
  const id = String(petId);
  if (ids.includes(id)) {
    return { caughtIds: ids, success: true, alreadyCaught: true };
  }
  if (roll <= successRate) {
    return { caughtIds: [...ids, id], success: true, alreadyCaught: false };
  }
  return { caughtIds: ids, success: false, alreadyCaught: false };
}

export function filterCaughtPets(pets, caughtIds) {
  return pets.map(normalizePet).filter((pet) => isPetCaught(caughtIds, pet.id));
}

export function collectAttributes(pets) {
  const preferredOrder = [
    "火", "水", "草", "电", "冰", "武", "毒", "土", "翼", "萌", "虫", "石",
    "幽灵", "龙", "恶魔", "机械", "光", "普通", "神火", "神水", "神草", "未知"
  ];
  const seen = new Set();

  pets.map(normalizePet).forEach((pet) => {
    pet.attributes.forEach((attribute) => seen.add(attribute));
  });

  return [...seen].sort((a, b) => {
    const indexA = preferredOrder.indexOf(a);
    const indexB = preferredOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b, "zh-CN");
    if (indexA === -1) return -1;
    if (indexB === -1) return 1;
    return indexA - indexB;
  });
}

const photoDefaults = [
  { x: 18, y: 62 },
  { x: 34, y: 50 },
  { x: 46, y: 58 },
  { x: 58, y: 48 },
  { x: 70, y: 60 }
];

export function createPhotoItem(pet, index) {
  const position = photoDefaults[index % photoDefaults.length];
  return {
    petId: pet.id,
    x: position.x,
    y: position.y,
    scale: 1,
    zIndex: index + 1
  };
}

export function layoutLineupItems(items) {
  const count = items.length;
  const layouts = {
    0: [],
    1: [{ x: 50 }],
    2: [{ x: 42 }, { x: 58 }],
    3: [{ x: 34 }, { x: 50 }, { x: 66 }],
    4: [{ x: 28 }, { x: 43 }, { x: 57 }, { x: 72 }],
    5: [{ x: 22 }, { x: 36 }, { x: 50 }, { x: 64 }, { x: 78 }]
  };
  const positions = layouts[count] || layouts[5];

  return items.slice(0, 5).map((item, index) => ({
    ...item,
    x: positions[index].x,
    y: 64,
    scale: count <= 2 ? 1.45 : 1.38,
    zIndex: index + 1
  }));
}

export function removeLineupItem(items, petId) {
  return items.filter((item) => item.petId !== petId).map((item, index) => ({ ...item, zIndex: index + 1 }));
}

const statLabels = {
  hp: "精力",
  attack: "物攻",
  defense: "物防",
  magicAttack: "魔攻",
  magicDefense: "魔防",
  speed: "速度"
};

const state = {
  pets: [],
  filteredPets: [],
  query: "",
  attribute: "全部",
  mode: "dex",
  photoQuery: "",
  photoItems: [],
  selectedPhotoPetId: "",
  background: "academy",
  caughtPetIds: [],
  detailMessage: ""
};

const maxPhotoItems = 5;
const caughtStorageKey = "roco-caught-pets";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

export function petImage(pet) {
  if (!pet.image) {
    return `<div class="pet-placeholder" aria-hidden="true">${escapeHtml(pet.name.slice(0, 1))}</div>`;
  }

  return `
    <img
      src="${escapeHtml(pet.image)}"
      alt="${escapeHtml(pet.name)}"
      loading="lazy"
      referrerpolicy="no-referrer"
      draggable="false"
      onerror="this.closest('.pet-visual, .detail-visual')?.classList.add('image-failed')"
    >
    <div class="pet-placeholder fallback" aria-hidden="true">${escapeHtml(pet.name.slice(0, 1))}</div>
  `;
}

function petById(petId) {
  return state.pets.find((pet) => pet.id === petId);
}

function photoImage(pet) {
  return petImage(pet).replaceAll("pet-visual, .detail-visual", "photo-pet, .pet-visual, .detail-visual");
}

function renderAttributeButtons(attributes) {
  const buttons = ["全部", ...attributes].map((attribute) => {
    const active = state.attribute === attribute ? " is-active" : "";
    return `<button class="filter-chip${active}" type="button" data-attribute="${escapeHtml(attribute)}">${escapeHtml(attribute)}</button>`;
  });

  document.querySelector("#attributeFilters").innerHTML = buttons.join("");
}

function renderPets() {
  const grid = document.querySelector("#petGrid");
  const empty = document.querySelector("#emptyState");
  const count = document.querySelector("#resultCount");
  state.filteredPets = filterPets(state.pets, state);

  count.textContent = `${state.filteredPets.length} / ${state.pets.length}`;
  empty.hidden = state.filteredPets.length > 0;

  grid.innerHTML = state.filteredPets.map((pet) => {
    const statsTotal = Object.values(pet.stats || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const caught = isPetCaught(state.caughtPetIds, pet.id);
    return `
      <article class="pet-card${caught ? " is-caught" : " is-uncaught"}" data-pet-id="${escapeHtml(pet.id)}" tabindex="0">
        <div class="pet-visual">${petImage(pet)}</div>
        <div class="pet-meta">
          <span class="pet-number">NO.${escapeHtml(pet.number || pet.id || "--")}</span>
          <h2>${escapeHtml(pet.name)}</h2>
          <div class="type-row">${pet.attributes.map((attribute) => `<span class="type-badge">${escapeHtml(attribute)}</span>`).join("")}</div>
          <div class="card-foot">
            <span class="catch-status">${caught ? "已捕捉" : "未捕捉"}</span>
            <strong>${statsTotal || "--"}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderMode() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === state.mode);
  });
  document.querySelector("#dexMode").classList.toggle("is-active", state.mode === "dex");
  document.querySelector("#photoMode").classList.toggle("is-active", state.mode === "photo");
}

function renderPhotoChoices() {
  const query = state.photoQuery.trim().toLowerCase();
  const caughtPets = filterCaughtPets(state.pets, state.caughtPetIds);
  const choices = caughtPets
    .filter((pet) => !query || [pet.name, pet.number, pet.id].join(" ").toLowerCase().includes(query))
    .slice(0, 18);

  if (!caughtPets.length) {
    document.querySelector("#photoChoices").innerHTML = `<p class="photo-empty">先去图鉴捕捉宠物。</p>`;
    return;
  }

  document.querySelector("#photoChoices").innerHTML = choices.map((pet) => {
    const added = state.photoItems.some((item) => item.petId === pet.id);
    const disabled = added || state.photoItems.length >= maxPhotoItems;
    return `
      <button class="photo-choice" type="button" data-add-pet="${escapeHtml(pet.id)}" ${disabled ? "disabled" : ""}>
        <span class="choice-thumb">${petImage(pet)}</span>
        <span>
          <strong>${escapeHtml(pet.name)}</strong>
          <small>NO.${escapeHtml(pet.number || pet.id || "--")}</small>
        </span>
      </button>
    `;
  }).join("");
}

function renderPhotoStage() {
  const stage = document.querySelector("#photoStage");
  stage.className = `photo-stage bg-${state.background}`;
  stage.querySelectorAll(".photo-pet").forEach((node) => node.remove());
  state.photoItems = state.photoItems.filter((item) => isPetCaught(state.caughtPetIds, item.petId));

  layoutLineupItems(state.photoItems)
    .forEach((item) => {
      const pet = petById(item.petId);
      if (!pet) return;
      const node = document.createElement("button");
      node.type = "button";
      node.className = `photo-pet${state.selectedPhotoPetId === item.petId ? " is-selected" : ""}`;
      node.dataset.photoPetId = item.petId;
      node.style.left = `${item.x}%`;
      node.style.top = `${item.y}%`;
      node.style.zIndex = item.zIndex;
      node.style.setProperty("--pet-scale", item.scale);
      node.innerHTML = `
        <span class="photo-pet-art">${photoImage(pet)}</span>
      `;
      stage.appendChild(node);
    });

  document.querySelector("#photoHint").hidden = state.photoItems.length > 0;
  const selectedItem = state.photoItems.find((item) => item.petId === state.selectedPhotoPetId);
  const selectedPet = selectedItem ? petById(selectedItem.petId) : null;
  document.querySelector("#selectedName").textContent = selectedPet ? selectedPet.name : "未选择";
}

function renderPhotoStudio() {
  renderPhotoChoices();
  renderPhotoStage();
}

function renderStats(stats) {
  const entries = Object.entries(statLabels);
  return entries.map(([key, label]) => {
    const value = Number(stats?.[key] || 0);
    const width = Math.max(8, Math.min(100, Math.round(value / 1.7)));
    return `
      <div class="stat-row">
        <span>${label}</span>
        <div class="stat-track"><i style="width:${width}%"></i></div>
        <strong>${value || "--"}</strong>
      </div>
    `;
  }).join("");
}

function openPetDetail(petId) {
  const pet = state.pets.find((item) => item.id === petId);
  if (!pet) return;
  const caught = isPetCaught(state.caughtPetIds, pet.id);

  const dialog = document.querySelector("#petDialog");
  document.querySelector("#dialogBody").innerHTML = `
    <div class="detail-visual">${petImage(pet)}</div>
    <div class="detail-copy">
      <span class="pet-number">NO.${escapeHtml(pet.number || pet.id || "--")}</span>
      <h2>${escapeHtml(pet.name)}</h2>
      <div class="type-row">${pet.attributes.map((attribute) => `<span class="type-badge">${escapeHtml(attribute)}</span>`).join("")}</div>
      <p>${escapeHtml(pet.description)}</p>
      <dl>
        <div><dt>组别</dt><dd>${escapeHtml(pet.group || "组别未知")}</dd></div>
        <div><dt>来源</dt><dd><a href="${escapeHtml(pet.sourceUrl || "#")}" target="_blank" rel="noreferrer">${escapeHtml(pet.source || "公开资料")}</a></dd></div>
      </dl>
      <div class="stats-panel">${renderStats(pet.stats)}</div>
      <div class="catch-panel">
        <button id="catchPetButton" type="button" data-catch-pet="${escapeHtml(pet.id)}" ${caught ? "disabled" : ""}>${caught ? "已捕捉" : "捕捉"}</button>
        <span id="catchMessage">${escapeHtml(state.detailMessage || (caught ? "已经收入本地图鉴。" : "60% 概率捕捉成功。"))}</span>
      </div>
    </div>
  `;
  dialog.showModal();
}

function saveCaughtPets() {
  localStorage.setItem(caughtStorageKey, serializeCaughtPets(state.caughtPetIds));
}

function bindEvents() {
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderMode();
    });
  });

  document.querySelector("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderPets();
  });

  document.querySelector("#clearButton").addEventListener("click", () => {
    state.query = "";
    state.attribute = "全部";
    document.querySelector("#searchInput").value = "";
    renderAttributeButtons(collectAttributes(state.pets));
    renderPets();
  });

  document.querySelector("#attributeFilters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-attribute]");
    if (!button) return;
    state.attribute = button.dataset.attribute;
    renderAttributeButtons(collectAttributes(state.pets));
    renderPets();
  });

  document.querySelector("#petGrid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-pet-id]");
    if (card) openPetDetail(card.dataset.petId);
  });

  document.querySelector("#petGrid").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest("[data-pet-id]");
    if (card) {
      event.preventDefault();
      openPetDetail(card.dataset.petId);
    }
  });

  document.querySelector("#closeDialog").addEventListener("click", () => {
    state.detailMessage = "";
    document.querySelector("#petDialog").close();
  });

  document.querySelector("#petDialog").addEventListener("click", (event) => {
    const button = event.target.closest("[data-catch-pet]");
    if (!button) return;
    const result = catchPet(state.caughtPetIds, button.dataset.catchPet, Math.random());
    state.caughtPetIds = result.caughtIds;
    if (result.alreadyCaught) {
      state.detailMessage = "已经捕捉过了。";
    } else if (result.success) {
      state.detailMessage = "捕捉成功！已解锁合影。";
      saveCaughtPets();
      renderPets();
      renderPhotoStudio();
    } else {
      state.detailMessage = "没有捕捉到，再试一次。";
    }
    openPetDetail(button.dataset.catchPet);
  });

  document.querySelector("#photoSearchInput").addEventListener("input", (event) => {
    state.photoQuery = event.target.value;
    renderPhotoChoices();
  });

  document.querySelector("#photoChoices").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-pet]");
    if (!button || state.photoItems.length >= maxPhotoItems) return;
    const pet = petById(button.dataset.addPet);
    if (!pet || state.photoItems.some((item) => item.petId === pet.id)) return;
    state.photoItems = [...state.photoItems, createPhotoItem(pet, state.photoItems.length)];
    state.selectedPhotoPetId = pet.id;
    document.querySelector("#exportStatus").textContent = "";
    renderPhotoStudio();
  });

  document.querySelector("#photoStage").addEventListener("click", (event) => {
    const petNode = event.target.closest("[data-photo-pet-id]");
    if (!petNode) return;
    state.selectedPhotoPetId = petNode.dataset.photoPetId;
    renderPhotoStage();
  });

  document.querySelector("#backgroundSelect").addEventListener("change", (event) => {
    state.background = event.target.value;
    renderPhotoStage();
  });

  document.querySelector("#removePhotoButton").addEventListener("click", () => {
    if (!state.selectedPhotoPetId) return;
    state.photoItems = removeLineupItem(state.photoItems, state.selectedPhotoPetId);
    state.selectedPhotoPetId = state.photoItems.at(-1)?.petId || "";
    renderPhotoStudio();
  });

  document.querySelector("#resetPhotoButton").addEventListener("click", () => {
    state.photoItems = [];
    state.selectedPhotoPetId = "";
    document.querySelector("#exportStatus").textContent = "";
    renderPhotoStudio();
  });

  document.querySelector("#exportPhotoButton").addEventListener("click", exportPhoto);
}

function drawBackground(ctx, width, height) {
  if (state.background === "forest") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#d8f4cf");
    gradient.addColorStop(0.52, "#5fb47b");
    gradient.addColorStop(1, "#1e6d59");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255,255,255,.32)";
    ctx.beginPath();
    ctx.arc(width * 0.22, height * 0.25, 90, 0, Math.PI * 2);
    ctx.fill();
  } else if (state.background === "paper") {
    ctx.fillStyle = "#fff8e8";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#d9efd8";
    ctx.fillRect(24, 24, width - 48, height - 48);
    ctx.strokeStyle = "#efbe63";
    ctx.lineWidth = 8;
    ctx.strokeRect(34, 34, width - 68, height - 68);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#bfe7ff");
    gradient.addColorStop(0.5, "#eaf7d8");
    gradient.addColorStop(1, "#7fcf8f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 209, 102, .55)";
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.18, 70, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function exportPhoto() {
  const status = document.querySelector("#exportStatus");
  if (state.photoItems.length < 2) {
    status.textContent = "至少添加 2 个精灵后再导出。";
    return;
  }

  status.textContent = "正在生成合影...";
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 760;
  const ctx = canvas.getContext("2d");
  drawBackground(ctx, canvas.width, canvas.height);

  try {
    for (const item of layoutLineupItems(state.photoItems).sort((a, b) => a.zIndex - b.zIndex)) {
      const pet = petById(item.petId);
      if (!pet?.image) continue;
      const image = await loadImage(pet.image);
      const size = 260 * item.scale;
      const x = (item.x / 100) * canvas.width;
      const y = (item.y / 100) * canvas.height;
      ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
    }

    const link = document.createElement("a");
    link.download = `roco-photo-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    status.textContent = "合影已导出为 PNG。";
  } catch (error) {
    status.textContent = "导出受外链图片限制影响失败了；摆拍预览仍可正常使用。";
  }
}

async function loadPets() {
  const response = await fetch("./data/pets.json");
  const payload = await response.json();
  state.pets = payload.pets.map(normalizePet);
  state.caughtPetIds = readCaughtPets(localStorage.getItem(caughtStorageKey));
  document.querySelector("#sourceLink").href = payload.sourceUrl;
  document.querySelector("#sourceName").textContent = payload.source;
  document.querySelector("#generatedAt").textContent = payload.generatedAt;
  renderAttributeButtons(collectAttributes(state.pets));
  renderPets();
  renderPhotoStudio();
}

if (typeof document !== "undefined") {
  bindEvents();
  loadPets().catch((error) => {
    document.querySelector("#emptyState").hidden = false;
    document.querySelector("#emptyState").textContent = `数据加载失败：${error.message}`;
  });
}
