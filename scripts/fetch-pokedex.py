import json
import re
import sys
import urllib.parse
import urllib.request

BASE_URL = "https://roco.dvg.cn/spirits.php"
ATTRIBUTE_PAGE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 17, 18]
SOURCE_NAME = "洛克小册子"
MAX_ITEMS = 160


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X) Codex static page generator"
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def parse_attributes(text):
    known = [
        "普通", "火", "水", "草", "电", "冰", "武", "毒", "土", "翼",
        "萌", "虫", "石", "幽灵", "龙", "恶魔", "机械", "光", "神火",
        "神水", "神草"
    ]
    found = []
    for attr in known:
        if re.search(rf"(^|[^\u4e00-\u9fa5]){attr}([^\u4e00-\u9fa5]|$)", text):
            found.append(attr)
    return found or ["未知"]


def parse_stats(text):
    labels = {
        "精力": "hp",
        "物攻": "attack",
        "物防": "defense",
        "魔攻": "magicAttack",
        "魔防": "magicDefense",
        "速度": "speed",
    }
    stats = {}
    for cn, key in labels.items():
        match = re.search(rf"{cn}\D*(\d+)", text)
        if match:
            stats[key] = int(match.group(1))
    return stats


def strip_tags(value):
    return " ".join(re.sub(r"<[^>]+>", " ", value).split())


def parse_cards(html):
    parts = re.split(r'<div class="position-relative">', html)
    return [part for part in parts if "/spirit_info.php?id=" in part and "编号:" in part]


def parse_pet(card, fallback_id, page_url):
    text = strip_tags(card)
    id_match = re.search(r"/spirit_info\.php\?id=(\d+)", card)
    number_match = re.search(r"(?:编号|NO\.?|No\.?)\s*[:：]?\s*(\d+)", text, re.IGNORECASE)
    name_match = re.search(
        r'<a href="/spirit_info\.php\?id=\d+"[^>]*class="d-flex flex-column gap-1">\s*([^<]+?)\s*</a>',
        card,
    )
    image_match = re.search(r'<img[^>]+src="([^"]*source_roco/dbsource/spirit/300/[^"]+)"', card)
    group_match = re.search(r"/>((?:[^<]*组别[^<]*)|(?:[^<]*组[^<]*))</a>", card)

    name = strip_tags(name_match.group(1)) if name_match else ""
    if not name and id_match:
        name = f"洛克宠物 {id_match.group(1)}"
    elif not name:
        name = f"洛克宠物 {fallback_id:03d}"

    return {
        "id": id_match.group(1) if id_match else f"pet-{fallback_id:03d}",
        "number": number_match.group(1) if number_match else (id_match.group(1) if id_match else ""),
        "name": name,
        "image": image_match.group(1) if image_match else "",
        "attributes": parse_attributes(text),
        "description": "来自公开图鉴页的快速样本数据，适合快速浏览与筛选。",
        "group": strip_tags(group_match.group(1)) if group_match else "",
        "stats": parse_stats(text),
        "source": SOURCE_NAME,
        "sourceUrl": urllib.parse.urljoin(page_url, f"/spirit_info.php?id={id_match.group(1)}") if id_match else page_url,
    }


def main():
    seen = set()
    pets = []
    for page_id in ATTRIBUTE_PAGE_IDS:
        page_url = f"{BASE_URL}?sx={page_id}"
        html = fetch(page_url)
        cards = parse_cards(html)
        for card in cards:
            pet = parse_pet(card, len(pets) + 1, page_url)
            key = pet["sourceUrl"]
            if key in seen or not pet["name"]:
                continue
            seen.add(key)
            pets.append(pet)
            if len(pets) >= MAX_ITEMS:
                break
        if len(pets) >= MAX_ITEMS:
            break

    if len(pets) < 20:
        print(f"Only parsed {len(pets)} pets; source structure may have changed.", file=sys.stderr)
        sys.exit(1)

    output = {
        "generatedAt": "2026-06-03",
        "source": SOURCE_NAME,
        "sourceUrl": f"{BASE_URL}?sx=1",
        "pets": pets,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
