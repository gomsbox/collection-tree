/* 나의 수집 자랑하기 — 마스터 데이터
 * 대카테고리 / 캐릭터 외형 옵션은 img/specs/interactive-elements.json 정의를 그대로 따른다.
 */
window.CT = window.CT || {};

CT.CATEGORIES = [
  { id: "fashion", label: "패션", example: "운동화", color: "#6BAE45", emoji: "👕", img: "assets/categories/fashion.png" },
  { id: "electronics", label: "전자기기", example: "이어폰", color: "#8E63D1", emoji: "🎧", img: "assets/categories/electronics.png" },
  { id: "life_goods", label: "생활용품", example: "머그컵", color: "#5A98DD", emoji: "☕", img: "assets/categories/life_goods.png" },
  { id: "beauty", label: "뷰티", example: "립스틱", color: "#E95581", emoji: "💄", img: "assets/categories/beauty.png" },
  { id: "hobby", label: "취미", example: "카메라", color: "#F28A33", emoji: "📷", img: "assets/categories/hobby.png" },
  { id: "stationery_goods", label: "문구/굿즈", example: "펜", color: "#E7B82F", emoji: "✏️", img: "assets/categories/stationery_goods.png" },
  { id: "doll_figure", label: "인형/피규어", example: "피규어", color: "#3BAFA6", emoji: "🪆", img: "assets/categories/doll_figure.png" },
  { id: "plant_interior", label: "식물/인테리어", example: "화분", color: "#6BAE45", emoji: "🪴", img: "assets/categories/plant_interior.png" },
];

CT.CHARACTERS = [
  { id: "bunny", label: "토끼", vibe: "부드럽고 귀여운 인상", color: "#6BAE45", emoji: "🐰", img: "assets/characters/bunny.png" },
  { id: "teddy", label: "곰돌이", vibe: "포근하고 따뜻한 분위기", color: "#9B6A38", emoji: "🧸", img: "assets/characters/teddy.png" },
  { id: "duck", label: "오리", vibe: "밝고 사랑스러운 무드", color: "#F9C43A", emoji: "🦆", img: "assets/characters/duck.png" },
  { id: "cat", label: "고양이", vibe: "도도하고 귀여운 매력", color: "#8A8A8A", emoji: "🐱", img: "assets/characters/cat.png" },
  { id: "astronaut", label: "우주복 캐릭터", vibe: "신비롭고 모험적인 느낌", color: "#5A98DD", emoji: "🧑‍🚀", img: "assets/characters/astronaut.png" },
  { id: "robot", label: "로봇", vibe: "활기차고 기계적인 매력", color: "#6D8F88", emoji: "🤖", img: "assets/characters/robot.png" },
  { id: "cactus", label: "선인장", vibe: "귀엽고 힐링되는 분위기", color: "#6BAE45", emoji: "🌵", img: "assets/characters/cactus.png" },
  { id: "handheld_game", label: "휴대용 게임기", vibe: "레트로한 수집 감성", color: "#E96D91", emoji: "🎮", img: "assets/characters/handheld_game.png" },
];

// game-elements.json branchSlots (desktop anchor 좌표, 1672x941 기준)를
// 트리 SVG viewBox(0 0 1200 800)에 맞게 비례 변환한 8개 기본 슬롯.
CT.TREE_SLOTS = [
  { x: 500, y: 246, branchFrom: "upper-left" },
  { x: 609, y: 233, branchFrom: "upper-center" },
  { x: 850, y: 256, branchFrom: "upper-right" },
  { x: 1040, y: 331, branchFrom: "far-right" },
  { x: 468, y: 456, branchFrom: "lower-left" },
  { x: 584, y: 456, branchFrom: "lower-center" },
  { x: 886, y: 507, branchFrom: "lower-right" },
  { x: 971, y: 502, branchFrom: "far-lower-right" },
];

CT.ACHIEVEMENTS = [
  { id: "first_charm", label: "첫 수집품 등록", icon: "🌱", test: (records) => records.length >= 1 },
  { id: "half_tree", label: "트리가 반쯤 채워졌어요", icon: "🌿", test: (records) => records.length >= 4 },
  { id: "full_tree", label: "수집 트리 완성!", icon: "🌳", test: (records) => records.length >= 8 },
  {
    id: "category_collector",
    label: "서로 다른 카테고리 5개 수집",
    icon: "🏅",
    test: (records) => new Set(records.map((r) => r.category)).size >= 5,
  },
];

CT.getCategory = (id) => CT.CATEGORIES.find((c) => c.id === id);
CT.getCharacter = (id) => CT.CHARACTERS.find((c) => c.id === id);
