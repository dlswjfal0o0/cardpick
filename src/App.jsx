import { useState, useEffect } from "react";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";
import { auth, provider, db } from "./firebase";
import { CARDS } from "./cards";

/* ── 상수 ── */
const CATEGORIES = ["쇼핑", "식음료", "교통", "주유", "여행", "통신"];
const BANK_COLORS = {
  shinhan: { bg: "#002D72", color: "#fff" },
  kb:      { bg: "#FFBC00", color: "#1A1816" },
  hyundai: { bg: "#00329E", color: "#fff" },
  samsung: { bg: "#1A1A1A", color: "#fff" },
  lotte:   { bg: "#E31837", color: "#fff" },
  woori:   { bg: "#007CC6", color: "#fff" },
  hana:    { bg: "#00897B", color: "#fff" },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [selected, setSelected] = useState([]);   // 비교 선택
  const [showCompare, setShowCompare] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [filters, setFilters] = useState({ type: "all", cat: "all", fee: 100000 });
  const [aiResult, setAiResult] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiForm, setAiForm] = useState({ spending: "", categories: [], note: "" });

  /* ── Auth ── */
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  /* ── Firestore 즐겨찾기 동기화 ── */
  useEffect(() => {
    if (!user) { setFavorites(new Set()); return; }
    const ref = collection(db, "users", user.uid, "favorites");
    const unsub = onSnapshot(ref, (snap) => {
      setFavorites(new Set(snap.docs.map((d) => Number(d.id))));
    });
    return unsub;
  }, [user]);

  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  /* ── 즐겨찾기 토글 ── */
  const toggleFav = async (cardId) => {
    if (!user) { alert("로그인 후 이용할 수 있어요!"); return; }
    const ref = doc(db, "users", user.uid, "favorites", String(cardId));
    if (favorites.has(cardId)) await deleteDoc(ref);
    else await setDoc(ref, { cardId, savedAt: new Date() });
  };

  /* ── 비교 선택 토글 ── */
  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else {
      if (selected.length >= 4) { alert("최대 4개까지 선택할 수 있어요."); return; }
      setSelected([...selected, id]);
    }
  };

  /* ── 필터링 ── */
  const filtered = CARDS.filter((c) => {
    if (filters.type !== "all" && c.type !== filters.type) return false;
    if (filters.cat !== "all" && !c.categories.includes(filters.cat)) return false;
    if (c.fee.domestic > filters.fee) return false;
    return true;
  });

  /* ── AI 추천 ── */
  const getAIRecommendation = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const prompt = `당신은 한국 신용카드/체크카드 전문가입니다.
아래 카드 목록과 사용자 정보를 바탕으로 최적의 카드를 추천해주세요.

[사용자 정보]
- 월 평균 지출: ${aiForm.spending || "미입력"}원
- 주로 사용하는 카테고리: ${aiForm.categories.length > 0 ? aiForm.categories.join(", ") : "미입력"}
- 추가 요청사항: ${aiForm.note || "없음"}

[카드 목록]
${CARDS.map((c) =>
  `- ${c.bankName} ${c.name} (${c.type === "credit" ? "신용" : "체크"}카드): 연회비 ${c.fee.domestic === 0 ? "무료" : c.fee.domestic.toLocaleString() + "원"}, 주요혜택: ${c.benefits.map((b) => b.text).join(" / ")}, 전월실적: ${c.minSpend === 0 ? "없음" : c.minSpend.toLocaleString() + "원"}`
).join("\n")}

위 정보를 바탕으로:
1. 가장 적합한 카드 2~3개를 선정해 이유를 설명해주세요.
2. 각 카드의 장단점을 간단히 비교해주세요.
3. 추가 팁이 있으면 알려주세요.
한국어로 친근하게 답변해주세요.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = data.content?.map((b) => b.text || "").join("") || "응답을 받지 못했어요.";
      setAiResult(text);
    } catch (e) {
      setAiResult("오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    }
    setAiLoading(false);
  };

  const compareCards = selected.map((id) => CARDS.find((c) => c.id === id));

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <header style={s.header}>
        <span style={s.logo}>Card<span style={{ color: "#1B5FE0" }}>Pick</span></span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {user ? (
            <>
              <img src={user.photoURL} alt="" style={s.avatar} />
              <span style={s.userName}>{user.displayName?.split(" ")[0]}</span>
              <button style={s.btnGhost} onClick={logout}>로그아웃</button>
            </>
          ) : (
            <button style={s.btnPrimary} onClick={login}>Google 로그인</button>
          )}
        </div>
      </header>

      <div style={s.container}>
        {/* ── HERO ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={s.h1}>내게 맞는 카드 찾기 🃏</h1>
          <p style={s.muted}>원하는 카드를 선택해 한눈에 비교하고, ♥로 즐겨찾기 해두세요.</p>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={s.filterBar}>
          <FilterGroup label="카드 종류">
            {["all", "credit", "check"].map((v) => (
              <Chip key={v} active={filters.type === v} onClick={() => setFilters({ ...filters, type: v })}>
                {v === "all" ? "전체" : v === "credit" ? "신용카드" : "체크카드"}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="카테고리">
            <Chip active={filters.cat === "all"} onClick={() => setFilters({ ...filters, cat: "all" })}>전체</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={filters.cat === c} onClick={() => setFilters({ ...filters, cat: c })}>{c}</Chip>
            ))}
          </FilterGroup>
          <FilterGroup label={`최대 연회비 ${filters.fee === 100000 ? "— 제한 없음" : filters.fee.toLocaleString() + "원"}`}>
            <input type="range" min={0} max={100000} step={5000} value={filters.fee}
              onChange={(e) => setFilters({ ...filters, fee: Number(e.target.value) })}
              style={{ width: 180, accentColor: "#1B5FE0" }} />
          </FilterGroup>
          <button style={{ ...s.btnPrimary, marginLeft: "auto" }} onClick={() => setShowAI(true)}>
            ✨ AI 추천 받기
          </button>
        </div>

        {/* ── 즐겨찾기 섹션 ── */}
        {user && favorites.size > 0 && (
          <>
            <SectionHeader title="⭐ 즐겨찾기" count={favorites.size} />
            <CardGrid>
              {CARDS.filter((c) => favorites.has(c.id)).map((card) => (
                <CardItem key={card.id} card={card} selected={selected.includes(card.id)}
                  fav={favorites.has(card.id)} onToggleSelect={toggleSelect} onToggleFav={toggleFav} />
              ))}
            </CardGrid>
            <div style={{ marginBottom: 32 }} />
          </>
        )}

        {/* ── 전체 카드 ── */}
        <SectionHeader title="전체 카드" count={filtered.length} />
        {filtered.length === 0 ? (
          <div style={s.empty}>해당 조건에 맞는 카드가 없어요. 필터를 바꿔보세요.</div>
        ) : (
          <CardGrid>
            {filtered.map((card) => (
              <CardItem key={card.id} card={card} selected={selected.includes(card.id)}
                fav={favorites.has(card.id)} onToggleSelect={toggleSelect} onToggleFav={toggleFav} />
            ))}
          </CardGrid>
        )}
      </div>

      {/* ── COMPARE FLOAT BTN ── */}
      {selected.length >= 2 && (
        <button style={s.floatBtn} onClick={() => setShowCompare(true)}>
          {selected.length}개 카드 비교하기 →
        </button>
      )}

      {/* ── COMPARE MODAL ── */}
      {showCompare && (
        <Modal onClose={() => setShowCompare(false)} title="카드 비교">
          <div style={{ overflowX: "auto" }}>
            <table style={s.compareTable}>
              <thead>
                <tr>
                  <th style={s.thLabel}></th>
                  {compareCards.map((c) => (
                    <td key={c.id} style={s.thCard}>{c.bankName}<br /><strong>{c.name}</strong></td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "카드 종류", fn: (c) => c.type === "credit" ? "신용카드" : "체크카드" },
                  { label: "국내 연회비", fn: (c) => c.fee.domestic === 0 ? "🎉 무료" : c.fee.domestic.toLocaleString() + "원" },
                  { label: "해외 연회비", fn: (c) => c.fee.intl === 0 ? "🎉 무료" : c.fee.intl.toLocaleString() + "원" },
                  { label: "주요 혜택", fn: (c) => c.benefits.map((b) => `${b.icon} ${b.text}`).join("\n") },
                  { label: "혜택 카테고리", fn: (c) => c.categories.join(", ") },
                  { label: "전월 실적", fn: (c) => c.minSpend === 0 ? "실적 무관" : c.minSpend.toLocaleString() + "원" },
                  { label: "최대 월 할인", fn: (c) => c.maxDiscount.toLocaleString() + "원" },
                  { label: "별점", fn: (c) => "★".repeat(Math.round(c.rating)) + " " + c.rating },
                ].map((row) => (
                  <tr key={row.label}>
                    <th style={s.tdLabel}>{row.label}</th>
                    {compareCards.map((c) => (
                      <td key={c.id} style={s.tdCell}>{row.fn(c)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>※ 위 정보는 참고용이며 정확한 내용은 각 카드사 홈페이지에서 확인하세요.</p>
        </Modal>
      )}

      {/* ── AI 추천 MODAL ── */}
      {showAI && (
        <Modal onClose={() => setShowAI(false)} title="✨ AI 카드 추천">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={s.formGroup}>
              <label style={s.label}>월 평균 지출 (원)</label>
              <input style={s.input} type="number" placeholder="예: 500000"
                value={aiForm.spending} onChange={(e) => setAiForm({ ...aiForm, spending: e.target.value })} />
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>주로 쓰는 카테고리 (복수 선택)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <Chip key={c}
                    active={aiForm.categories.includes(c)}
                    onClick={() => {
                      const cats = aiForm.categories.includes(c)
                        ? aiForm.categories.filter((x) => x !== c)
                        : [...aiForm.categories, c];
                      setAiForm({ ...aiForm, categories: cats });
                    }}>{c}</Chip>
                ))}
              </div>
            </div>
            <div style={s.formGroup}>
              <label style={s.label}>추가 요청사항</label>
              <textarea style={s.textarea} placeholder="예: 연회비 없는 카드 위주로, 해외 여행을 자주 가요..."
                value={aiForm.note} onChange={(e) => setAiForm({ ...aiForm, note: e.target.value })} />
            </div>
            <button style={s.btnPrimary} onClick={getAIRecommendation} disabled={aiLoading}>
              {aiLoading ? "AI가 분석 중이에요... ✨" : "추천 받기"}
            </button>
            {aiResult && (
              <div style={s.aiResult}>
                {aiResult.split("\n").map((line, i) => (
                  <p key={i} style={{ margin: "4px 0" }}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── 서브 컴포넌트 ── */
function CardItem({ card, selected, fav, onToggleSelect, onToggleFav }) {
  const bankStyle = BANK_COLORS[card.bank] || { bg: "#888", color: "#fff" };
  return (
    <div style={{ ...s.card, ...(selected ? s.cardSelected : {}) }} onClick={() => onToggleSelect(card.id)}>
      <div style={s.cardHeader}>
        <div style={{ ...s.bankBadge, background: bankStyle.bg, color: bankStyle.color }}>
          {card.bankName.slice(0, 2)}
        </div>
        <div style={{ flex: 1 }}>
          <span style={{ ...s.typeBadge, ...(card.type === "credit" ? s.badgeCredit : s.badgeCheck) }}>
            {card.type === "credit" ? "신용" : "체크"}
          </span>
          <div style={s.cardName}>{card.bankName} {card.name}</div>
          <div style={s.cardFee}>{card.fee.domestic === 0 ? "연회비 무료" : `연회비 ${card.fee.domestic.toLocaleString()}원`}</div>
        </div>
        <button style={s.favBtn} onClick={(e) => { e.stopPropagation(); onToggleFav(card.id); }}>
          {fav ? "❤️" : "🤍"}
        </button>
      </div>
      <div style={{ marginBottom: 12 }}>
        {card.benefits.map((b, i) => (
          <div key={i} style={s.benefit}>
            <span style={s.benefitIcon}>{b.icon}</span>
            <span style={{ fontSize: 13 }}>{b.text}</span>
          </div>
        ))}
      </div>
      <div style={s.tagRow}>
        {card.tags.map((t) => <span key={t} style={s.tag}>#{t}</span>)}
      </div>
      <div style={s.cardFooter}>
        <span style={{ fontSize: 13, color: "#B45A0A" }}>{"★".repeat(Math.round(card.rating))} {card.rating}</span>
        <button style={{ ...s.selectBtn, ...(selected ? s.selectBtnActive : {}) }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(card.id); }}>
          {selected ? "선택 취소" : "비교 선택"}
        </button>
      </div>
      {selected && <div style={s.selectedBadge}>✓ 선택됨</div>}
    </div>
  );
}

function CardGrid({ children }) {
  return <div style={s.grid}>{children}</div>;
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <h2 style={s.h2}>{title}</h2>
      <span style={s.muted}>{count}개</span>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={s.filterLabel}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button style={{ ...s.chip, ...(active ? s.chipActive : {}) }} onClick={onClick}>{children}</button>
  );
}

function Modal({ onClose, title, children }) {
  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h2 style={s.h2}>{title}</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── 스타일 ── */
const s = {
  page: { minHeight: "100vh", background: "#F4F2EE", fontFamily: "'Noto Sans KR', sans-serif", color: "#1A1816" },
  header: { background: "#fff", borderBottom: "1px solid #D8D4CC", padding: "0 28px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  logo: { fontFamily: "monospace", fontSize: 20, fontWeight: 700 },
  avatar: { width: 32, height: 32, borderRadius: "50%", objectFit: "cover" },
  userName: { fontSize: 14, fontWeight: 500 },
  container: { maxWidth: 1100, margin: "0 auto", padding: "32px 24px" },
  h1: { fontSize: 26, fontWeight: 700, marginBottom: 6, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: 700 },
  muted: { color: "#7A7670", fontSize: 14 },

  filterBar: { background: "#fff", border: "1px solid #D8D4CC", borderRadius: 14, padding: "20px 24px", marginBottom: 28, display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-end" },
  filterLabel: { fontSize: 11, fontWeight: 700, color: "#7A7670", textTransform: "uppercase", letterSpacing: 0.5 },
  chip: { height: 32, padding: "0 14px", borderRadius: 20, border: "1px solid #D8D4CC", background: "#fff", fontSize: 13, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" },
  chipActive: { background: "#1A1816", color: "#fff", borderColor: "#1A1816" },

  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 },
  card: { background: "#fff", border: "1.5px solid #D8D4CC", borderRadius: 14, padding: 22, cursor: "pointer", transition: "all 0.18s", position: "relative", overflow: "hidden" },
  cardSelected: { borderColor: "#1B5FE0", background: "#E8EFFE" },
  cardHeader: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  bankBadge: { width: 50, height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 },
  typeBadge: { fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "inline-block", marginBottom: 3 },
  badgeCredit: { background: "#EEE9FF", color: "#5B3FC4" },
  badgeCheck: { background: "#E4F4ED", color: "#0E7A4E" },
  cardName: { fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 },
  cardFee: { fontSize: 12, color: "#7A7670", fontFamily: "monospace" },
  favBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 20, padding: 0, flexShrink: 0 },
  benefit: { display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 },
  benefitIcon: { width: 22, height: 22, borderRadius: 6, background: "#F4F2EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 },
  tag: { fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#EEECE8", color: "#7A7670" },
  cardFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #D8D4CC" },
  selectBtn: { fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, border: "1px solid #D8D4CC", background: "transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" },
  selectBtnActive: { background: "#1B5FE0", color: "#fff", borderColor: "#1B5FE0" },
  selectedBadge: { position: "absolute", top: 14, right: 14, fontSize: 11, fontWeight: 700, background: "#1B5FE0", color: "#fff", padding: "3px 9px", borderRadius: 12 },

  floatBtn: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1A1816", color: "#fff", border: "none", padding: "14px 28px", borderRadius: 32, fontSize: 15, fontWeight: 700, cursor: "pointer", zIndex: 99, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.25)" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  modal: { background: "#fff", borderRadius: "14px 14px 0 0", width: "100%", maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", padding: "28px 24px" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  closeBtn: { width: 32, height: 32, borderRadius: "50%", border: "1px solid #D8D4CC", background: "transparent", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#7A7670" },

  compareTable: { width: "100%", borderCollapse: "collapse" },
  thLabel: { background: "#EEECE8", padding: "10px 16px", fontSize: 13, fontWeight: 700, width: 110 },
  thCard: { background: "#1A1816", color: "#fff", padding: "10px 16px", fontSize: 13, textAlign: "center" },
  tdLabel: { background: "#EEECE8", padding: "12px 16px", fontSize: 13, fontWeight: 700, borderBottom: "1px solid #D8D4CC", verticalAlign: "top" },
  tdCell: { padding: "12px 16px", fontSize: 13, borderBottom: "1px solid #D8D4CC", verticalAlign: "top", whiteSpace: "pre-line" },

  formGroup: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 700, color: "#1A1816" },
  input: { height: 40, border: "1px solid #D8D4CC", borderRadius: 8, padding: "0 12px", fontSize: 14, fontFamily: "inherit", outline: "none" },
  textarea: { height: 80, border: "1px solid #D8D4CC", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical" },
  aiResult: { background: "#F4F2EE", borderRadius: 10, padding: 16, fontSize: 14, lineHeight: 1.8 },

  btnPrimary: { background: "#1A1816", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { background: "transparent", border: "1px solid #D8D4CC", padding: "7px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },

  empty: { textAlign: "center", padding: "60px 20px", color: "#7A7670" },
};
