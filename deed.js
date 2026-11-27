/* 즐부 허브 — 등기 생성기
   일반매매 · 경매(법원 촉탁 / 직접 등기) · 공매(온비드·캠코)
   입력값은 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다. */
(function () {
  "use strict";

  var root = document.getElementById("view-deed");
  if (!root) return;

  var $ = function (sel) { return root.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
  var KEY = "zlbu-deed-v1";
  var TYPE = "sale";
  var MODE = "chuktak";
  var NOTE = "※ 즐부 허브가 입력값으로 만든 초안입니다. 접수 전 관할 등기소·법원의 최신 서식과 기재사항을 대조하세요.";

  /* ============================================================
     유틸
     ============================================================ */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(el) {
    if (!el) return 0;
    var v = String(el.value || "").replace(/[^\d]/g, "");
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }
  function numf(el) {
    if (!el) return 0;
    var n = parseFloat(String(el.value || "").replace(/[^\d.]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function won(n) { return Math.round(n || 0).toLocaleString("ko-KR"); }
  function money(n) { return "금 " + won(n) + "원"; }
  function v(x) {
    x = (x == null ? "" : String(x)).trim();
    return x ? esc(x).replace(/\n/g, "<br>") : "&nbsp;";
  }
  function vv(x) { x = (x == null ? "" : String(x)).trim(); return x ? esc(x) : ""; }
  function hv(x) { x = (x == null ? "" : String(x)).trim(); return x ? esc(x) : "&nbsp;"; }
  function dateCell(v) {
    var d = kdate(v);
    return d ? esc(d) : "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일";
  }
  function fmtInput(el) {
    var d = String(el.value || "").replace(/[^\d]/g, "");
    el.value = d ? Number(d).toLocaleString("ko-KR") : "";
  }
  function kdate(s) {
    if (!s) return "";
    var p = String(s).split("-");
    if (p.length !== 3) return "";
    return p[0] + "년 " + Number(p[1]) + "월 " + Number(p[2]) + "일";
  }
  function kdateDot(s) {
    if (!s) return "";
    var p = String(s).split("-");
    if (p.length !== 3) return "";
    return p[0] + ". " + Number(p[1]) + ". " + Number(p[2]) + ".";
  }
  var DG = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  var DP = ["천", "백", "십", ""];
  function ko4(n) {
    var s = String(n).padStart(4, "0"), out = "";
    for (var i = 0; i < 4; i++) {
      var k = Number(s.charAt(i));
      if (k) out += DG[k] + DP[i];
    }
    return out;
  }
  function koAmt(n) {
    n = Math.round(n || 0);
    if (!n) return "영";
    var eok = Math.floor(n / 1e8), man = Math.floor((n % 1e8) / 1e4), wonN = n % 1e4, out = "";
    if (eok) out += ko4(eok) + "억";
    if (man) out += ko4(man) + "만";
    if (wonN) out += ko4(wonN);
    return out;
  }
  function illGeum(n) { return "일금 " + koAmt(n) + "원정"; }
  function pct(r) {
    var p = r * 100;
    return (Math.round(p * 100) / 100).toString().replace(/\.0$/, "") + "%";
  }

  /* ============================================================
     요율표 (2026년 현행 기준)
     - 취득세: 지방세법 제11조·제13조의2 / 지방교육세법 제151조 / 농어촌특별세법 제5조
     - 국민주택채권: 주택도시기금법 시행령 제8조 [별표]
     - 등기신청수수료: 등기사항증명서 등 수수료규칙 (2025.8.1. 시행)
     - 인지세: 인지세법 제3조·제6조
     ============================================================ */
  function houseRate(amount) {
    if (amount <= 6e8) return 0.01;
    if (amount <= 9e8) {
      var p = (amount * 2) / 3e8 - 3;                 // %
      p = Math.round(p * 1e4) / 1e4;                   // 소수점 5째자리 반올림
      return p / 100;
    }
    return 0.03;
  }
  function bondRate(kind, std, region) {
    var metro = region === "metro";
    if (kind === "house") {
      if (std < 2e7) return 0;
      if (std < 5e7) return 0.013;
      if (std < 1e8) return metro ? 0.019 : 0.014;
      if (std < 1.6e8) return metro ? 0.021 : 0.016;
      if (std < 2.6e8) return metro ? 0.023 : 0.018;
      if (std < 6e8) return metro ? 0.026 : 0.021;
      return metro ? 0.031 : 0.026;
    }
    if (kind === "land") {
      if (std < 5e6) return 0;
      if (std < 5e7) return metro ? 0.025 : 0.020;
      if (std < 1e8) return metro ? 0.040 : 0.035;
      return metro ? 0.050 : 0.045;
    }
    if (std < 1e7) return 0;
    if (std < 1.3e8) return metro ? 0.010 : 0.008;
    if (std < 2.5e8) return metro ? 0.016 : 0.014;
    return metro ? 0.020 : 0.018;
  }
  function stampTax(amount, kind) {
    if (amount <= 1e7) return 0;
    if (amount <= 3e7) return 20000;
    if (amount <= 5e7) return 40000;
    if (amount <= 1e8) return kind === "house" ? 0 : 70000;  // 주택 1억 이하 비과세
    if (amount <= 1e9) return 150000;
    return 350000;
  }
  function floor10(n) { return Math.floor(n / 10) * 10; }
  function round1man(n) { return Math.round(n / 10000) * 10000; }

  function kindLabel(k) { return k === "house" ? "주택" : k === "land" ? "토지" : "건축물"; }
  function kindDeedName(k) { return k === "house" ? "공동주택" : k === "land" ? "토지(대지)" : "건축물"; }
  function kindPurpose(k) { return k === "house" ? "주택" : k === "land" ? "대지" : "근린생활시설"; }

  /* ============================================================
     상태 읽기
     ============================================================ */
  var F = {
    addr: "#fAddr", display: "#fDisplay", uniq: "#fUniq", kind: "#fKind", area: "#fArea",
    std: "#fStd", region: "#fRegion", amount: "#fAmount", date1: "#fDate1", date2: "#fDate2",
    dealNo: "#fDealNo", court: "#fCourt", caseNo: "#fCaseNo", creditor: "#fCreditor",
    debtor: "#fDebtor", owner: "#fOwner", disposer: "#fDisposer", manageNo: "#fManageNo",
    gmDebtor: "#fGmDebtor", gmRrn: "#fGmRrn", gmAddr: "#fGmAddr",
    sellerName: "#fSellerName", sellerRrn: "#fSellerRrn", sellerAddr: "#fSellerAddr", sellerTel: "#fSellerTel",
    buyerName: "#fBuyerName", buyerRrn: "#fBuyerRrn", buyerAddr: "#fBuyerAddr", buyerTel: "#fBuyerTel",
    agentName: "#fAgentName", agentTel: "#fAgentTel", agentAddr: "#fAgentAddr",
    houseCount: "#fHouseCount", adjust: "#fAdjust", temp2: "#fTemp2", first: "#fFirst",
    firstLimit: "#fFirstLimit", erasures: "#fErasures", erasureList: "#fErasureList",
    discount: "#fDiscount", feeMethod: "#fFeeMethod"
  };
  function val(key) { var el = $(F[key]); return el ? el.value : ""; }
  function chk(key) { var el = $(F[key]); return !!(el && el.checked); }

  function readState() {
    return {
      type: TYPE, mode: MODE,
      addr: val("addr"), display: val("display"), uniq: val("uniq"),
      kind: val("kind"), area: numf($(F.area)), std: num($(F.std)), region: val("region"),
      amount: num($(F.amount)), date1: val("date1"), date2: val("date2"), dealNo: val("dealNo"),
      court: val("court"), caseNo: val("caseNo"), creditor: val("creditor"),
      debtor: val("debtor"), owner: val("owner"),
      disposer: val("disposer"), manageNo: val("manageNo"),
      gmDebtor: val("gmDebtor"), gmRrn: val("gmRrn"), gmAddr: val("gmAddr"),
      sellerName: val("sellerName"), sellerRrn: val("sellerRrn"), sellerAddr: val("sellerAddr"), sellerTel: val("sellerTel"),
      buyerName: val("buyerName"), buyerRrn: val("buyerRrn"), buyerAddr: val("buyerAddr"), buyerTel: val("buyerTel"),
      agentName: val("agentName"), agentTel: val("agentTel"), agentAddr: val("agentAddr"),
      houseCount: Number(val("houseCount") || 1), adjust: chk("adjust"), temp2: chk("temp2"),
      first: chk("first"), firstLimit: Number(val("firstLimit") || 2000000),
      erasures: num($(F.erasures)), erasureList: val("erasureList"),
      discount: Number(String(val("discount")).replace(/[^\d.]/g, "") || 15),
      feeMethod: val("feeMethod")
    };
  }

  /* ============================================================
     계산
     ============================================================ */
  function calc(s) {
    var c = {
      rate: 0, rateText: "", surcharge: 0, acq: 0, edu: 0, farm: 0, reduction: 0, taxTotal: 0,
      bondRate: 0, bondAmount: 0, bondCost: 0, discount: s.discount,
      farmBase: 0, farmReduce: 0,
      stamp: 0, stampLabel: "", fee: 0, feeLabel: "",
      erasureFee: 0, erasureEdu: 0, erasureTotal: 0, post: 0, total: 0, notes: []
    };
    var amt = s.amount;

    /* --- 취득세율 --- */
    var surcharge = 0;
    if (s.kind === "house" && !s.first) {
      var n = s.houseCount, adj = s.adjust;
      if (n >= 4) surcharge = 0.12;
      else if (n === 3) surcharge = adj ? 0.12 : 0.08;
      else if (n === 2) surcharge = (adj && !s.temp2) ? 0.08 : 0;
    }
    c.surcharge = surcharge;

    if (s.kind === "house") {
      var base = houseRate(amt);
      c.rate = surcharge || base;
      if (surcharge) {
        c.acq = floor10(amt * surcharge);
        c.edu = floor10(amt * 0.004);
        c.farmBase = s.area > 85 ? floor10(amt * (surcharge === 0.08 ? 0.006 : 0.01)) : 0;
        c.rateText = "중과 " + pct(surcharge);
      } else {
        c.acq = floor10(amt * base);
        c.edu = floor10(amt * base * 0.1);
        c.farmBase = s.area > 85 ? floor10(amt * 0.002) : 0;
        c.rateText = pct(base) + (amt > 6e8 && amt <= 9e8 ? " (6~9억 구간식)" : "");
      }
      if (s.first && amt > 0 && amt <= 12e8) {
        c.reduction = Math.min(c.acq, s.firstLimit);
        c.acq = Math.max(0, c.acq - c.reduction);
        c.farmReduce = s.area > 85 ? floor10(c.reduction * 0.2) : 0;
        c.rateText = pct(base) + " · 생애최초 감면";
      } else if (s.first && amt > 12e8) {
        c.notes.push("생애최초 감면은 취득당시가액 12억원 이하 주택만 받을 수 있어 적용하지 않았습니다.");
      }
      c.farm = c.farmBase + c.farmReduce;
    } else {
      c.rate = 0.04;
      c.rateText = "4% (주택 외)";
      c.acq = floor10(amt * 0.04);
      c.edu = floor10(amt * 0.004);
      c.farmBase = floor10(amt * 0.002);
      c.farm = c.farmBase;
    }
    c.taxTotal = c.acq + c.edu + c.farm;

    /* --- 국민주택채권 --- */
    c.bondRate = bondRate(s.kind, s.std, s.region);
    c.bondAmount = c.bondRate ? Math.max(10000, round1man(s.std * c.bondRate)) : 0;
    c.bondCost = Math.round(c.bondAmount * (c.discount / 100));

    /* --- 인지세 · 수입인지 --- */
    if (s.type === "sale") {
      c.stamp = stampTax(amt, s.kind);
      c.stampLabel = c.stamp ? "매매계약서 1통 기준" : (s.kind === "house" && amt <= 1e8 ? "주택 1억원 이하 비과세" : "1천만원 이하 비과세");
    } else if (s.type === "auction") {
      c.stamp = 1500;
      c.stampLabel = "완납증명 500 + 결정 정본 1,000";
    } else {
      c.stamp = 0;
      c.stampLabel = "해당 없음 (캠코 촉탁)";
    }

    /* --- 등기신청수수료 --- */
    var single = s.feeMethod === "paper" ? 18000 : s.feeMethod === "eform" ? 15000 : 10000;
    if (s.type === "sale") {
      c.fee = single;
      c.feeLabel = "소유권이전 (서면 18,000 / 전자표준 15,000 / 전자 10,000)";
    } else if (s.type === "auction" && s.mode === "direct") {
      c.fee = single + s.erasures * 4000;
      c.feeLabel = "소유권이전 + 말소 건당 4,000";
    } else {
      c.fee = 18000 + s.erasures * 4000;
      c.feeLabel = "촉탁 18,000 + 말소 건당 4,000";
    }

    /* --- 말소 등록면허세 (경매·공매) --- */
    if (s.type !== "sale" && s.erasures > 0) {
      c.erasureFee = s.erasures * 6000;
      c.erasureEdu = s.erasures * 1200;
      c.erasureTotal = c.erasureFee + c.erasureEdu;
    }

    /* --- 우편료 --- */
    if ((s.type === "auction" && s.mode === "chuktak") || s.type === "gongmae") c.post = 11200;

    c.total = c.taxTotal + c.stamp + c.fee + c.erasureTotal + c.post + c.bondCost;

    /* --- 안내문 --- */
    if (c.surcharge) c.notes.push("다주택 중과(" + pct(c.surcharge) + ")가 적용되었습니다. 일시적 2주택·시가표준액 1억원(수도권) 이하 주택 등 중과 제외 사유는 계약 전에 확인하세요.");
    if (s.first) c.notes.push("생애최초 감면은 취득세 본세에서만 " + won(Math.min(c.reduction, s.firstLimit)) + "원을 뺀 계산입니다. 취득일부터 3년 안에 팔거나 증여·임대하면 추징됩니다.");
    if (s.kind === "house" && s.area > 85 && c.farm > 0) c.notes.push("전용 85㎡ 초과라 농어촌특별세가 붙었습니다. 85㎡ 이하는 비과세입니다.");
    if (s.kind === "house" && s.area > 0 && s.area <= 85) c.notes.push("전용 85㎡ 이하라 농어촌특별세는 부과되지 않습니다.");
    if (!c.bondRate) c.notes.push("시가표준액이 국민주택채권 매입 기준 미만이라 채권 매입 대상이 아닙니다.");
    else c.notes.push("국민주택채권은 즉시매도 기준입니다. 할인율은 매일 바뀌니 등기 당일 은행 고시값으로 다시 계산하세요.");
    if (s.type === "auction") c.notes.push("경매 취득세는 매각대금 완납일부터 60일 안에 신고·납부합니다.");
    if (s.type === "gongmae") c.notes.push("공매 취득세는 잔대금 납부일부터 60일 안에 신고·납부합니다.");
    if (s.erasures > 0) c.notes.push("말소 등록면허세는 건당 6,000원에 지방교육세 20%(1,200원)가 붙습니다. 위택스에서 신고·납부합니다.");

    return c;
  }

  /* ============================================================
     화면: 요약
     ============================================================ */
  function sumRow(label, sub, amount, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th>' + label +
      (sub ? '<small>' + sub + '</small>' : '') + '</th><td>' + (amount == null ? "—" : won(amount) + "원") + '</td></tr>';
  }

  function renderSum(s, c) {
    var host = $("#deedSum");
    if (!host) return;
    var badge = s.kind === "house"
      ? (c.surcharge ? '<span class="sum-badge sum-badge--warn">다주택 중과 ' + pct(c.surcharge) + '</span>' : '<span class="sum-badge">취득세율 ' + c.rateText + '</span>')
      : '<span class="sum-badge">주택 외 취득세 4%</span>';
    if (s.first) badge += ' <span class="sum-badge">생애최초 감면 ' + won(c.reduction) + '원</span>';

    var html = '<div class="sum-card">'
      + '<div class="sum-head">'
      + '<div><span class="sum-kicker">취득세 등</span><strong>' + won(c.taxTotal) + '원</strong></div>'
      + '<div><span class="sum-kicker">총 예상비용</span><strong>' + won(c.total) + '원</strong></div>'
      + '</div>'
      + '<div>' + badge + '</div>'
      + '<table class="sum-t"><tbody>'
      + sumRow("취득세", c.rateText + " · 과세표준 " + won(s.amount) + "원", c.acq)
      + sumRow("지방교육세", c.surcharge ? "중과 0.4%" : (s.kind === "house" ? "취득세율의 10%" : "0.4%"), c.edu)
      + sumRow("농어촌특별세", s.kind === "house" ? (s.area > 85 ? "85㎡ 초과 " + (c.surcharge === 0.12 ? "1.0%" : c.surcharge === 0.08 ? "0.6%" : "0.2%") : "85㎡ 이하 비과세") : "0.2%", c.farm)
      + (c.reduction ? sumRow("생애최초 감면", "취득세에서 공제", -c.reduction, "is-sub") : "")
      + sumRow("국민주택채권 매입액", c.bondRate ? "시가표준액 × " + (c.bondRate * 100).toFixed(2) + "%" : "매입 대상 아님", c.bondAmount)
      + sumRow("즉시매도 실부담금", "매입액 × " + c.discount + "% (당일 고시)", c.bondCost)
      + sumRow(s.type === "auction" ? "수입인지" : "인지세", c.stampLabel, c.stamp)
      + sumRow("등기신청수수료", c.feeLabel, c.fee)
      + (c.erasureTotal ? sumRow("말소 등록면허세", s.erasures + "건 × 7,200원 (지방교육세 포함)", c.erasureTotal) : "")
      + (c.post ? sumRow("우편료", "선납등기 대봉투 2개 × 5,600원", c.post) : "")
      + sumRow("합계", "채권 실부담금 포함", c.total, "is-total")
      + '</tbody></table>';
    if (c.notes.length) {
      html += '<ul class="sum-notes">' + c.notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join("") + '</ul>';
    }
    html += '</div>';
    host.innerHTML = html;
  }

  /* ============================================================
     문서 조각
     ============================================================ */
  function sheet(key, title, sub, body) {
    return '<article class="doc-sheet" data-doc="' + key + '">'
      + '<div class="doc-head"><h3>' + title + '</h3>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>'
      + body
      + '<p class="doc-note">' + NOTE + '</p>'
      + '</article>';
  }
  function r(label, value, cls) {
    return '<tr><th class="doc-l">' + label + '</th><td colspan="3"' + (cls ? ' class="' + cls + '"' : '') + '>' + value + '</td></tr>';
  }
  function r2(l1, v1, l2, v2) {
    return '<tr><th class="doc-l">' + l1 + '</th><td>' + v1 + '</td><th class="doc-l">' + l2 + '</th><td>' + v2 + '</td></tr>';
  }
  function rows(list) { return '<table class="doc-t"><tbody>' + list.join("") + '</tbody></table>'; }
  function list(items, one) {
    return '<ul class="doc-list' + (one ? ' doc-list--one' : '') + '">' + items.map(function (t) {
      if (t.charAt(0) === "#") return '<li class="doc-list__head">' + esc(t.slice(1)) + '</li>';
      return '<li>' + esc(t) + '</li>';
    }).join("") + '</ul>';
  }
  function signBlock(dateText, lines, to) {
    return '<div class="doc-sign">'
      + '<p class="doc-date">' + (dateText || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + lines.map(function (l) { return '<p>' + l + '</p>'; }).join("")
      + '</div>' + (to ? '<p class="doc-to">' + to + '</p>' : '');
  }
  function line(name) {
    return '<span class="doc-line">' + (vv(name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span>';
  }
  function addrBlock(s) {
    var a = vv(s.addr), d = vv(s.display);
    if (!a && !d) return "&nbsp;";
    return (a || "") + (d ? (a ? "<br>" : "") + d.replace(/\n/g, "<br>") : "");
  }
  function buyer(s) {
    return { name: s.buyerName, rrn: s.buyerRrn, addr: s.buyerAddr, tel: s.buyerTel };
  }
  function former(s) {
    if (s.type === "sale") return { name: s.sellerName, rrn: s.sellerRrn, addr: s.sellerAddr, tel: s.sellerTel };
    if (s.type === "auction") return { name: s.owner || s.debtor, rrn: "", addr: "", tel: "" };
    return { name: s.gmDebtor, rrn: s.gmRrn, addr: s.gmAddr, tel: "" };
  }

  function partyTable(s) {
    var b = buyer(s), f = former(s);
    return '<table class="doc-t doc-t--cols"><colgroup><col style="width:11%"><col style="width:14%"><col style="width:24%"><col style="width:43%"><col style="width:8%"></colgroup><thead><tr>'
      + '<th class="doc-l">구분</th><th>성명<br><span class="doc-mini">(상호·명칭)</span></th>'
      + '<th>주민등록번호<br><span class="doc-mini">(등기용등록번호)</span></th><th>주소</th><th>지분</th>'
      + '</tr></thead><tbody>'
      + '<tr><th class="doc-l">등기의무자</th><td>' + v(f.name) + '</td><td>' + v(f.rrn) + '</td><td>' + v(f.addr) + '</td><td class="doc-c">전부</td></tr>'
      + '<tr><th class="doc-l">등기권리자</th><td>' + v(b.name) + '</td><td>' + v(b.rrn) + '</td><td>' + v(b.addr) + '</td><td class="doc-c">전부</td></tr>'
      + '</tbody></table>';
  }

  function bondTable(s, c) {
    var rateText = c.bondRate ? (c.bondRate * 100).toFixed(2) + "%" : "매입 대상 아님";
    return '<table class="doc-t"><thead><tr>'
      + '<th class="doc-l">부동산 표시</th><th>시가표준액</th><th>국민주택채권 매입금액</th>'
      + '</tr></thead><tbody>'
      + '<tr><td>1. ' + kindDeedName(s.kind) + (vv(s.addr) ? "<br>" + vv(s.addr) : "") + '</td>'
      + '<td class="doc-num">' + money(s.std) + '</td>'
      + '<td class="doc-num">' + money(c.bondAmount) + '</td></tr>'
      + '<tr class="doc-total"><th class="doc-l">국민주택채권 매입 총액</th><td colspan="2">' + money(c.bondAmount) + ' <span class="doc-mini">(매입률 ' + rateText + ')</span></td></tr>'
      + '<tr><th class="doc-l">국민주택채권 발행번호</th><td colspan="2">&nbsp;</td></tr>'
      + '</tbody></table>';
  }

  function taxTable(s, c) {
    return '<table class="doc-t"><tbody>'
      + '<tr><th class="doc-l">취득세</th><td class="doc-num">' + money(c.acq) + '</td><th class="doc-l">지방교육세</th><td class="doc-num">' + money(c.edu) + '</td></tr>'
      + '<tr><th class="doc-l">농어촌특별세</th><td class="doc-num">' + money(c.farm) + '</td><th class="doc-l">세액 합계</th><td class="doc-num">' + money(c.taxTotal) + '</td></tr>'
      + '<tr><th class="doc-l">등기신청수수료</th><td class="doc-num">' + money(c.fee) + '</td><th class="doc-l">' + (s.type === "auction" ? "수입인지" : "인지세") + '</th><td class="doc-num">' + money(c.stamp) + '</td></tr>'
      + '</tbody></table>';
  }

  function deedInfoTable(s) {
    return '<table class="doc-t doc-t--cols"><colgroup><col style="width:19%"><col style="width:25%"><col style="width:18%"><col style="width:19%"><col style="width:19%"></colgroup><thead><tr><th class="doc-l">등기의무자의 등기필정보</th><th>부동산고유번호</th><th>성명(명칭)</th><th>일련번호</th><th>비밀번호</th></tr></thead><tbody>'
      + '<tr><th class="doc-l">기재란</th><td>' + v(s.uniq) + '</td><td>' + v(former(s).name) + '</td><td>&nbsp;</td><td>&nbsp;</td></tr>'
      + '</tbody></table>';
  }

  function costTable(s, c) {
    return '<h4 class="doc-sub">예상 비용</h4>'
      + '<table class="doc-t"><tbody>'
      + '<tr><th class="doc-l">취득세 등</th><td class="doc-num">' + money(c.taxTotal) + '</td><td class="doc-mini">취득세 ' + won(c.acq) + ' / 지방교육세 ' + won(c.edu) + ' / 농특세 ' + won(c.farm) + '</td></tr>'
      + '<tr><th class="doc-l">국민주택채권 실부담</th><td class="doc-num">' + money(c.bondCost) + '</td><td class="doc-mini">매입액 ' + won(c.bondAmount) + ' × 할인 ' + c.discount + '%</td></tr>'
      + '<tr><th class="doc-l">' + (s.type === "auction" ? "수입인지" : "인지세") + '</th><td class="doc-num">' + money(c.stamp) + '</td><td class="doc-mini">' + esc(c.stampLabel) + '</td></tr>'
      + '<tr><th class="doc-l">등기신청수수료</th><td class="doc-num">' + money(c.fee) + '</td><td class="doc-mini">' + esc(c.feeLabel) + '</td></tr>'
      + (c.erasureTotal ? '<tr><th class="doc-l">말소 등록면허세</th><td class="doc-num">' + money(c.erasureTotal) + '</td><td class="doc-mini">' + s.erasures + '건 × 7,200원</td></tr>' : '')
      + (c.post ? '<tr><th class="doc-l">우편료</th><td class="doc-num">' + money(c.post) + '</td><td class="doc-mini">선납등기 대봉투 2개</td></tr>' : '')
      + '<tr class="doc-total"><th class="doc-l">합계</th><td class="doc-num">' + money(c.total) + '</td><td class="doc-mini">' + illGeum(c.total) + '</td></tr>'
      + '</tbody></table>';
  }

  /* ---------------- 취득세 신고서 ---------------- */
  function docAcqTax(s, c) {
    var b = buyer(s), f = former(s);
    var cause = s.type === "sale" ? "일반매매" : s.type === "auction" ? "경락" : "공매";
    var acqDate = s.date2 || s.date1;
    var body = '<h4 class="doc-sub">신고인 · 취득물건</h4>'
      + '<table class="doc-t"><tbody>'
      + r2("취득자(신고인)", v(b.name) + ' <span class="doc-mini">' + vv(b.rrn) + '</span>', "전화번호", v(b.tel))
      + r("신고인 주소", v(b.addr))
      + r2("전 소유자", v(f.name) + ' <span class="doc-mini">' + vv(f.rrn) + '</span>', "전화번호", v(f.tel))
      + r("전 소유자 주소", v(f.addr))
      + r("매도자와의 관계", "지방세법상 특수관계인이 아닙니다. ■")
      + '</tbody></table>'
      + '<table class="doc-t"><tbody>'
      + r("소재지", (vv(s.addr) || "&nbsp;"))
      + r2("취득일", (kdateDot(acqDate) || "&nbsp;"), "면적(㎡)", (s.area ? String(s.area) : "&nbsp;"))
      + r2("종류·용도", kindDeedName(s.kind) + " / " + kindPurpose(s.kind), "취득원인", cause)
      + r("취득가액", money(s.amount))
      + '</tbody></table>'
      + '<h4 class="doc-sub">세액</h4>'
      + '<table class="doc-t"><thead><tr><th class="doc-l">세목</th><th>과세표준</th><th>세율</th><th>산출세액</th></tr></thead><tbody>'
      + '<tr><td>취득세</td><td class="doc-num">' + won(s.amount) + '</td><td class="doc-c">' + (c.surcharge ? pct(c.surcharge) : pct(c.rate)) + '</td><td class="doc-num">' + won(c.acq + c.reduction) + '</td></tr>'
      + (c.reduction ? '<tr><td>생애최초 감면</td><td class="doc-c">—</td><td class="doc-c">—</td><td class="doc-num">- ' + won(c.reduction) + '</td></tr>' : '')
      + '<tr><td>지방교육세</td><td class="doc-num">' + won(s.amount) + '</td><td class="doc-c">' + (c.surcharge ? "0.4%" : pct(c.rate * 0.1)) + '</td><td class="doc-num">' + won(c.edu) + '</td></tr>'
      + '<tr><td>농어촌특별세</td><td class="doc-num">' + won(s.amount) + '</td><td class="doc-c">' + (c.farmBase ? (s.kind === "house" ? (s.area > 85 ? (c.surcharge === 0.12 ? "1.0%" : c.surcharge === 0.08 ? "0.6%" : "0.2%") : "—") : "0.2%") : "—") + '</td><td class="doc-num">' + won(c.farmBase) + '</td></tr>'
      + (c.farmReduce ? '<tr><td>농어촌특별세(감면분)</td><td class="doc-c">—</td><td class="doc-c">20%</td><td class="doc-num">' + won(c.farmReduce) + '</td></tr>' : '')
      + '<tr class="doc-total"><th class="doc-l">합계</th><td colspan="2"></td><td class="doc-num">' + money(c.taxTotal) + '</td></tr>'
      + '</tbody></table>'
      + '<h4 class="doc-sub">첨부서류</h4>'
      + list([
        "취득가액을 증명하는 서류(매매계약서·매각허가결정·매각대금납입영수증 등) 사본 1부",
        "취득세 감면신청서 1부(생애최초 등 감면을 받는 경우)",
        "위임장 1부(대리인이 신고하는 경우)",
        s.kind === "house" ? "주택 취득 상세 명세서, 세대주 등본, 주민등록초본, 가족관계증명서(주택 취득 시)" : "법인장부 등 취득가액 증빙(법인인 경우)"
      ], true)
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신고인 <span class="doc-line">' + (vv(b.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(서명 또는 인)</span></p>'
      + '</div><p class="doc-to">시장 · 군수 · 구청장 귀하</p>';

    return sheet("acqtax", "취득세 신고서", "지방세법 시행규칙 별지 제3호서식 · 앞면", body);
  }

  /* ---------------- 위임장 ---------------- */
  function docPower(s) {
    var purpose = s.type === "sale" ? "소유권이전등기 신청" : s.type === "auction" ? "소유권이전등기 촉탁신청" : "등기청구";
    var delegator = s.type === "sale"
      ? { label: "매도인", name: s.sellerName, rrn: s.sellerRrn, addr: s.sellerAddr }
      : { label: "매수인", name: s.buyerName, rrn: s.buyerRrn, addr: s.buyerAddr };
    var cause = s.type === "sale" ? kdate(s.date1) + " 매매"
      : s.type === "auction" ? kdate(s.date2) + " 매각"
        : kdate(s.date1) + " 공매";
    var body = '<table class="doc-t"><tbody>'
      + r("부동산의 표시", addrBlock(s))
      + r("등기원인과 그 연월일", v(cause))
      + r("등기의 목적", s.type === "sale" ? "소유권이전" : "소유권이전(경매·공매)")
      + r("이전할 지분", "전부")
      + r("대리인", v(s.agentName))
      + r("대리인 연락처", v(s.agentTel))
      + r("대리인 주소", v(s.agentAddr))
      + '</tbody></table>'
      + '<p class="doc-body">위 사람을 대리인으로 정하고, 위 부동산의 ' + purpose + ' 및 취하에 관한 모든 권한을 위임합니다. 또한 복대리인의 선임을 허락합니다.</p>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>위임인 <span class="doc-flag">' + delegator.label + '</span> <span class="doc-line">' + (vv(delegator.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> ' + (vv(delegator.rrn) ? '<span class="doc-mini">' + vv(delegator.rrn) + '</span>' : '') + ' <span class="doc-stamp">(인)</span></p>'
      + (s.type === "sale" ? '<p>위임인 <span class="doc-flag">매수인</span> <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span></p>' : '')
      + '</div><p class="doc-to">' + (s.type === "gongmae" ? "한국자산관리공사 귀중" : "등기소 귀중") + '</p>';
    return sheet("power", "위 임 장", "", body);
  }

  /* ---------------- 매매대금 확인서 ---------------- */
  function docReceipt(s) {
    var body = '<table class="doc-t"><tbody>'
      + r("부동산의 표시", addrBlock(s))
      + r("매매대금", money(s.amount) + " (" + illGeum(s.amount) + ")")
      + r("계약일 / 잔금일", hv(kdate(s.date1)) + " / " + hv(kdate(s.date2)))
      + '</tbody></table>'
      + '<p class="doc-body">위 부동산의 매매와 관련하여 매수인이 매도인에게 위 매매대금 전액을 지급하였고, 매도인이 이를 수령하였음을 확인합니다. 대금은 매수인 명의 계좌에서 매도인 명의 계좌로 이체하여 금융기록을 남겼습니다.</p>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>매도인 ' + line(s.sellerName) + '</p>'
      + '<p>매수인 ' + line(s.buyerName) + '</p></div>';
    return sheet("receipt", "매매대금 수령·지급 확인서", "부동산 매매 잔금 확인용", body);
  }

  /* ---------------- 경매: 완납증명 신청서 ---------------- */
  function docPaid(s, c) {
    var body = '<table class="doc-t"><tbody>'
      + r2("사건번호", v(s.caseNo), "수입인지", "500원")
      + r("채권자", v(s.creditor))
      + r("채무자", v(s.debtor))
      + r("소유자", v(s.owner || s.debtor))
      + '</tbody></table>'
      + '<p class="doc-body">위 사건에 관하여 다음 사항을 증명하여 주시기 바랍니다.</p>'
      + '<table class="doc-t"><tbody>'
      + r("매수인", v(s.buyerName) + (vv(s.buyerRrn) ? ' <span class="doc-mini">' + vv(s.buyerRrn) + '</span>' : ''))
      + r("매각대금", money(s.amount) + " (" + illGeum(s.amount) + ")")
      + r("매각대금 완납일", v(kdate(s.date2)))
      + '</tbody></table>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신청인 <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(날인 또는 서명)</span></p>'
      + '<p>연락처 ' + (vv(s.buyerTel) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</p></div>'
      + '<p class="doc-to">' + (vv(s.court) || "○○지방법원") + ' 귀중</p>';
    return sheet("paid", "매각대금완납증명 신청서", "법원 경매계 제출 · 수입인지 500원", body);
  }

  /* ---------------- 경매: 촉탁신청서 ---------------- */
  function docEntrust(s, c) {
    var attach = [
      "부동산 목록 4통",
      "부동산등기사항전부증명서 1통",
      "토지대장등본 1통",
      "건축물대장등본 1통",
      "주민등록초본 1통",
      "등기신청수수료 영수증 (" + won(c.fee) + "원 = 18,000 + 말소 " + s.erasures + "건 × 4,000)",
      "취득세 영수증 (" + won(c.taxTotal) + "원)",
      "등록면허세 영수증(말소분, " + won(c.erasureTotal) + "원)",
      "말소할 사항 4부",
      "국민주택채권 발행번호·매입금액 (" + won(c.bondAmount) + "원)",
      "등기필증 우편송부 신청서와 영수증",
      "선납등기 대봉투 2개"
    ];
    var body = '<table class="doc-t"><tbody>'
      + r("사건번호", v(s.caseNo))
      + r2("채권자", v(s.creditor), "채무자", v(s.debtor))
      + r("매수인", v(s.buyerName) + (vv(s.buyerRrn) ? ' <span class="doc-mini">' + vv(s.buyerRrn) + '</span>' : ""))
      + '</tbody></table>'
      + '<p class="doc-body">위 사건에 관하여 매수인 <b>' + (vv(s.buyerName) || "○○○") + '</b>은(는) 귀원으로부터 매각허가결정을 받고 '
      + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + ' 대금 전액(' + money(s.amount) + ')을 완납하였으므로, '
      + '별지 목록 기재 부동산에 대하여 <b>소유권이전 및 말소등기</b>를 촉탁하여 주시기 바랍니다.</p>'
      + '<h4 class="doc-sub">첨부서류</h4>' + list(attach, true)
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신청인 <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span></p>'
      + '<p>연락처 ' + (vv(s.buyerTel) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</p></div>'
      + '<p class="doc-to">' + (vv(s.court) || "○○지방법원") + ' 귀중</p>'
      + '<p class="doc-mini" style="margin-top:10px">☞ 첨부서류의 등기사항전부증명서·주민등록등(초)본·토지대장 및 건축물대장등본은 발행일로부터 3개월 이내의 것이어야 합니다. 등록세 영수필확인서의 시가표준액이 500만원 이상이면 국민주택채권을 매입하고 발행번호를 기재합니다.</p>';
    return sheet("entrust", "부동산소유권이전등기 촉탁신청서", "법원에 제출 → 법원이 등기소에 촉탁", body);
  }

  /* ---------------- 경매: 부동산 목록 ---------------- */
  function docPropertyList(s) {
    var body = '<table class="doc-t"><thead><tr><th style="width:54px">번호</th><th>부동산의 표시</th></tr></thead><tbody>'
      + '<tr><td class="doc-c">1</td><td>' + (addrBlock(s) || "&nbsp;") + (s.uniq ? '<br><span class="doc-mini">부동산고유번호 ' + vv(s.uniq) + '</span>' : '') + '</td></tr>'
      + '</tbody></table>'
      + '<p class="doc-mini">4부를 만들어 법원과 등기소에 제출합니다. 면적·구조는 등기사항전부증명서 표제부와 같게 적습니다.</p>';
    return sheet("bplist", "부동산 목록 (4부)", "촉탁 대상 부동산", body);
  }

  /* ---------------- 경매: 말소할 사항 ---------------- */
  function parseErasures(text) {
    return String(text || "").split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var parts = l.split(/\s*\|\s*|\t+/);
      return { rank: parts[0] || "", what: parts[1] || "", date: parts[2] || "", no: parts[3] || "", memo: parts[4] || "" };
    });
  }
  function docErasures(s) {
    var items = parseErasures(s.erasureList);
    if (!items.length) {
      items = [{ rank: "", what: "", date: "", no: "", memo: "" }];
      for (var i = 0; i < 4; i++) items.push({ rank: "", what: "", date: "", no: "", memo: "" });
    }
    var body = '<table class="doc-t"><thead><tr><th style="width:64px">순위번호</th><th>등기목적</th><th style="width:96px">접수일자</th><th style="width:92px">접수번호</th><th>비고</th></tr></thead><tbody>'
      + items.map(function (x) {
        return '<tr><td class="doc-c">' + esc(x.rank) + '</td><td>' + esc(x.what) + '</td><td class="doc-c">' + esc(x.date) + '</td><td class="doc-c">' + esc(x.no) + '</td><td>' + esc(x.memo) + '</td></tr>';
      }).join("")
      + '</tbody></table>'
      + '<p class="doc-mini">말소 ' + (s.erasures || items.length) + '건 · 4부 작성. 입력한 순서대로 적었으니 등기사항전부증명서와 대조하세요.</p>';
    return sheet("erasures", "말 소 할 사 항 (4부)", "경매로 소멸하는 권리", body);
  }

  /* ---------------- 경매: 등기필증 우편송부 ---------------- */
  function docMail(s) {
    var body = '<table class="doc-t"><tbody>'
      + r("사건번호", v(s.caseNo))
      + r("부동산의 표시", addrBlock(s))
      + '</tbody></table>'
      + '<p class="doc-body">위 사건에 관하여 매수인은 소유권이전등기촉탁으로 인한 등기필증을 다음과 같이 우편송부하여 줄 것을 신청합니다.</p>'
      + '<table class="doc-t"><tbody>'
      + r("1. 수령받을 매수인", v(s.buyerName))
      + r("2. 송달장소", v(s.buyerAddr))
      + r("3. 연락처", v(s.buyerTel))
      + r("4. 우편료", "5,600원(선납등기 라벨을 붙인 대봉투 2개)")
      + '</tbody></table>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신청인(매수인) <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(서명)</span></p></div>'
      + '<p class="doc-mini">매수인 또는 수인의 매수인 중 1인이어야 합니다. 수인의 매수인 중 1인을 수령인으로 지정하면 본인서명사실확인서 발급증을 함께 냅니다.</p>';
    return sheet("mail", "등기필증 우편송부 신청서", "경매계에 대봉투와 함께 제출", body);
  }

  /* ---------------- 경매 직접등기: 신청서 ---------------- */
  function docAuctionDirect(s, c) {
    var b = buyer(s);
    var body = '<table class="doc-t"><tbody>'
      + '<tr><th class="doc-l">접수</th><td>　　　년 　월 　일 제 　　　호</td><th class="doc-l">처리인</th><td>등기관 확인 · 각종 통지</td></tr>'
      + '</tbody></table>'
      + '<h4 class="doc-sub">부동산의 표시</h4>'
      + rows([
        r("소재지·표시", addrBlock(s)),
        r("부동산 고유번호", v(s.uniq)),
        r("등기원인과 그 연월일", dateCell(s.date2) + " 매각 (강제경매)"),
        r("등기의 목적", "소유권이전"),
        r("이전할 지분", "전부")
      ])
      + '<h4 class="doc-sub">당사자</h4>'
      + partyTable(s)
      + '<h4 class="doc-sub">시가표준액 및 국민주택채권매입금액</h4>'
      + bondTable(s, c)
      + '<h4 class="doc-sub">세액</h4>'
      + taxTable(s, c)
      + '<h4 class="doc-sub">등기의무자의 등기필정보</h4>'
      + deedInfoTable(s)
      + '<h4 class="doc-sub">첨부서면</h4>'
      + list([
        "매각허가결정 정본 1통",
        "매각대금완납증명서 1통",
        "등기사항전부증명서 1통",
        "토지대장등본 1통",
        "건축물대장등본 1통",
        "주민등록초본 1통",
        "취득세 영수필확인서 1통",
        "등록면허세 영수필확인서(말소분) 1통",
        "등기신청수수료 영수필확인서 1통",
        "위임장 1통",
        "인감증명서 또는 본인서명사실확인서 발급증 1통"
      ])
      + signBlock(kdate(s.date2), [
        '위 신청인 <span class="doc-line">' + (vv(b.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span>',
        '(또는) 위 대리인 <span class="doc-line">' + (vv(s.agentName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> (전화 : ' + (vv(s.agentTel) || vv(b.tel) || "") + ')'
      ], "○○지방법원 등기소 귀중")
      + '<p class="doc-mini" style="margin-top:8px">등기원인일은 매각대금 완납일로 적었습니다. 관할 등기소 관행에 따라 매각기일로 적는 경우가 있으니 접수 전 확인하세요.</p>';
    return sheet("app-auction", "소유권이전등기신청서", "경매(직접 등기) · 부동산 1건", body);
  }

  /* ---------------- 경매 직접등기: 말소등기신청서 ---------------- */
  function docEraseApp(s, c) {
    var b = buyer(s);
    var body = '<table class="doc-t"><tbody>'
      + '<tr><th class="doc-l">접수</th><td>　　　년 　월 　일 제 　　　호</td><th class="doc-l">처리인</th><td>등기관 확인 · 각종 통지</td></tr>'
      + '</tbody></table>'
      + rows([
        r("부동산의 표시", addrBlock(s)),
        r("등기원인과 그 연월일", dateCell(s.date2) + " 매각"),
        r("등기의 목적", "말소"),
        r("말소할 등기", s.erasureList ? esc(s.erasureList).replace(/\n/g, "<br>") : "별지 말소할 사항 참조")
      ])
      + '<h4 class="doc-sub">당사자</h4>'
      + partyTable(s)
      + '<h4 class="doc-sub">세액 · 수수료</h4>'
      + rows([
        r2("등록면허세(말소분)", money(c.erasureFee), "지방교육세", money(c.erasureEdu)),
        r("등기신청수수료", money(s.erasures * 4000) + " <span class=\"doc-mini\">(말소 " + s.erasures + "건 × 4,000원)</span>")
      ])
      + '<h4 class="doc-sub">첨부서면</h4>'
      + list([
        "매각허가결정 정본 1통",
        "매각대금완납증명서 1통",
        "등록면허세 영수필확인서 1통",
        "등기신청수수료 영수필확인서 1통",
        "등기사항전부증명서 1통"
      ], true)
      + signBlock(kdate(s.date2), ['위 신청인 <span class="doc-line">' + (vv(b.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span>'], "○○지방법원 등기소 귀중");
    return sheet("erase-app", "말소등기신청서", "경매로 소멸한 권리 말소", body);
  }

  /* ---------------- 공매: 등기(등록)청구서 ---------------- */
  function docGongmae(s, c) {
    var b = buyer(s);
    var body = '<table class="doc-t"><tbody>'
      + r2("처분청(위임기관)", v(s.disposer), "관리번호", v(s.manageNo))
      + '</tbody></table>'
      + '<table class="doc-t"><thead><tr><th class="doc-l">구분</th><th>성명(상호)</th><th>주민(법인)등록번호</th><th>주소 또는 거소</th></tr></thead><tbody>'
      + '<tr><th class="doc-l">등기(등록)의무자<br><span class="doc-mini">(체납자)</span></th><td>' + v(s.gmDebtor) + '</td><td>' + v(s.gmRrn) + '</td><td>' + v(s.gmAddr) + '</td></tr>'
      + '<tr><th class="doc-l">등기(등록)청구인<br><span class="doc-mini">(매수자)</span></th><td>' + v(b.name) + '</td><td>' + v(b.rrn) + '</td><td>' + v(b.addr) + '</td></tr>'
      + '</tbody></table>'
      + '<table class="doc-t"><tbody>'
      + r("재산의 표시", addrBlock(s))
      + r2("매각결정일자", v(kdateDot(s.date1)), "대금납부일자", v(kdateDot(s.date2)))
      + r2("납부금액", money(s.amount), "취득세", money(c.acq + c.edu + c.farm))
      + '</tbody></table>'
      + '<p class="doc-body">「국세징수법」 제93조 및 「지방세징수법」 제96조에 의하여 위 공매재산의 소유권이전등기촉탁을 청구합니다.</p>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>청구인 <span class="doc-line">' + (vv(b.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(서명 또는 인)</span></p>'
      + '<p>연락처 ' + (vv(b.tel) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</p></div>'
      + '<p class="doc-to">한국자산관리공사 귀중</p>'
      + '<p class="doc-mini" style="margin-top:10px">붙임: 취득세 납부영수증 1부, 등록면허세(말소분) 납부영수증 1부, 매수인 인적사항 확인용 주민등록초본 1부.</p>';
    return sheet("gongmae", "등기(등록)청구서", "온비드 공매 · 캠코 제출", body);
  }

  /* ---------------- 공매: 등기필증 수령 요청서 ---------------- */
  function docCertPickup(s) {
    var body = '<table class="doc-t"><tbody>'
      + r("관리번호", v(s.manageNo))
      + r("매수물건의 표시", addrBlock(s))
      + '</tbody></table>'
      + '<p class="doc-body">귀사의 공매에서 매수한 위 물건의 소유권이전등기촉탁 완료 후 「등기필증」을 다음과 같이 수령하고자 합니다.</p>'
      + '<table class="doc-t"><tbody>'
      + '<tr><th class="doc-l">수령 방법</th><td colspan="3">□ 본인이 직접 수령　　<b>■ 배달증명우편으로 송부 요청</b></td></tr>'
      + r("등기필증 수령지", v(s.buyerAddr))
      + r2("신청인", v(s.buyerName), "연락처", v(s.buyerTel))
      + r("배달증명 우편료", "5,600원(선납 라벨을 붙인 대봉투 2개)")
      + '</tbody></table>'
      + '<p class="doc-mini">배달증명우편 송부를 요청하면 1회 발송을 원칙으로 하고, 반송되면 직접 방문해 수령합니다. 발송 중 분실·훼손 등에 대한 민·형사상 책임은 캠코에 묻지 않습니다.</p>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신청인 <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span></p></div>';
    return sheet("pickup", "등기필증 수령 요청서", "캠코 제출", body);
  }

  /* ---------------- 등록면허세 신고서 (말소분) ---------------- */
  function docRegTax(s, c) {
    var b = buyer(s);
    var n = s.erasures || 1;
    var body = '<table class="doc-t"><tbody>'
      + r2("신고인", v(b.name) + (vv(b.rrn) ? ' <span class="doc-mini">' + vv(b.rrn) + '</span>' : ''), "전화번호", v(b.tel))
      + r("주소", v(b.addr))
      + '</tbody></table>'
      + '<table class="doc-t"><tbody>'
      + r("소재지", (vv(s.addr) || "&nbsp;"))
      + r2("물건명", kindDeedName(s.kind), "등기·등록 종류", "말소등기 " + n + "건")
      + r2("등기·등록 원인", "말소", "등록가액", "건당 정액")
      + '</tbody></table>'
      + '<h4 class="doc-sub">납부할 세액</h4>'
      + '<table class="doc-t"><tbody>'
      + r2("등록면허세", money(c.erasureFee) + ' <span class="doc-mini">(6,000원 × ' + n + '건)</span>', "지방교육세", money(c.erasureEdu) + ' <span class="doc-mini">(20%)</span>')
      + '<tr class="doc-total"><th class="doc-l">합계</th><td colspan="3" class="doc-num">' + money(c.erasureTotal) + '</td></tr>'
      + '</tbody></table>'
      + '<p class="doc-mini">「지방세법」 제28조 제4항의 최저한세(건당 6,000원)를 적용했습니다. 실제 금액은 위택스 신고 화면에서 확정됩니다.</p>'
      + '<div class="doc-sign"><p class="doc-date">' + (kdate(s.date2) || "20&nbsp;&nbsp;년&nbsp;&nbsp;월&nbsp;&nbsp;일") + '</p>'
      + '<p>신고인 <span class="doc-line">' + (vv(b.name) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(서명 또는 인)</span></p></div>'
      + '<p class="doc-to">시장 · 군수 · 구청장 귀하</p>';
    return sheet("regtax", "등록면허세 신고서", "말소등기분 · 위택스 신고용", body);
  }

  /* ---------------- 체크리스트 ---------------- */
  function checklist(s, c) {
    if (s.type === "sale") {
      return [
        ["#계약 전", [
          "등기사항전부증명서(말소사항 포함) — 근저당·가압류·가처분 확인",
          "건축물대장·토지대장 — 면적·용도·위반건축물 확인",
          "전입세대 열람 — 임차인·주민등록 확인",
          "국세·지방세 완납증명서, 매도인 신분증",
          "매도인 인감증명서 또는 본인서명사실확인서(3개월 이내)"
        ]],
        ["#계약", [
          "매매계약서 2통 작성 — 전자수입인지 첨부(1억 초과 15만원, 10억 초과 35만원)",
          "계약금 영수증, 특약(근저당 말소·잔금일·위약금)",
          "부동산거래신고 — 계약일부터 30일 이내(거래신고필증)"
        ]],
        ["#잔금 전 (은행)", [
          "국민주택채권 매입 — 시가표준액 기준 " + (c.bondRate ? won(c.bondAmount) + "원 (매입률 " + (c.bondRate * 100).toFixed(2) + "%)" : "매입 대상 아님"),
          "즉시매도 선택 시 실부담 약 " + won(c.bondCost) + "원 (할인 " + c.discount + "%)",
          "잔금 자금 준비, 매도인 근저당 말소 확인"
        ]],
        ["#등기 전 (관공서)", [
          "취득세 신고·납부 — 위택스/이택스, 취득일부터 60일 이내 (예상 " + won(c.taxTotal) + "원)",
          "등기신청수수료 — 인터넷등기소 또는 수납은행 (" + won(c.fee) + "원)",
          "인지세 — 전자수입인지 (" + won(c.stamp) + "원)"
        ]],
        ["#등기 (등기소)", [
          "소유권이전등기신청서, 위임장",
          "매매계약서, 취득세·등기신청수수료 영수필확인서",
          "매도인 등기필정보(일련번호·비밀번호) 또는 등기필증",
          "매도인 인감증명서·주민등록초본, 매매목록",
          "접수 후 등기완료통지·등기필정보 수령"
        ]]
      ];
    }
    if (s.type === "auction" && s.mode === "chuktak") {
      return [
        ["#잔금 전 (법원)", [
          "매각허가결정 확정 확인 — 항고 기간 경과",
          "잔금 준비(매각대금 + 이자), 수입인지 500원·1,000원",
          "등기신청수수료 " + won(c.fee) + "원 (18,000 + 말소 " + s.erasures + "건 × 4,000)"
        ]],
        ["#잔금일 (법원 경매계)", [
          "매각대금 완납 → 매각대금완납증명 신청서 제출",
          "매각허가결정 정본·등본 교부 신청",
          "소유권이전등기 촉탁신청서 + 부동산 목록 4부 + 말소할 사항 4부",
          "등기필증 우편송부 신청서 + 선납등기 대봉투 2개"
        ]],
        ["#관공서 (구청)", [
          "취득세 신고·납부 — 위택스/이택스 (" + won(c.taxTotal) + "원, 60일 이내)",
          "말소분 등록면허세 — 위택스 (" + won(c.erasureTotal) + "원)",
          "영수필확인서를 법원에 제출"
        ]],
        ["#은행", [
          "국민주택채권 매입 " + won(c.bondAmount) + "원 → 발행번호 기재",
          "즉시매도 실부담 약 " + won(c.bondCost) + "원"
        ]],
        ["#등기 후", [
          "등기필증 우편 수령, 등기사항전부증명서로 말소 확인",
          "명도·인도명령, 점유자 협상"
        ]]
      ];
    }
    if (s.type === "auction") {
      return [
        ["#등기 전 (법원)", [
          "매각대금완납증명서, 매각허가결정 정본 확보",
          "등기필정보(일련번호·비밀번호) 발급 확인",
          "수입인지 500원·1,000원"
        ]],
        ["#관공서 (구청)", [
          "취득세 신고·납부 (" + won(c.taxTotal) + "원, 60일 이내)",
          "말소분 등록면허세 (" + won(c.erasureTotal) + "원)",
          "영수필확인서 출력"
        ]],
        ["#은행", [
          "국민주택채권 매입 " + won(c.bondAmount) + "원",
          "즉시매도 실부담 약 " + won(c.bondCost) + "원"
        ]],
        ["#등기 (등기소)", [
          "소유권이전등기신청서 + 말소등기신청서",
          "등기신청수수료 " + won(c.fee) + "원 (18,000 + 말소 " + s.erasures + "건 × 4,000)",
          "첨부: 매각허가결정 정본, 완납증명서, 등기사항전부증명서, 토지·건축물대장, 주민등록초본, 인감증명/본인서명확인서"
        ]]
      ];
    }
    return [
      ["#잔대금 납부 (온비드)", [
        "매각결정 후 기한 내 잔대금 납부",
        "매각결정문, 잔대금 납입영수증 출력",
        "수입인지 없음 — 대신 배달증명 우편료 5,600원 × 2"
      ]],
      ["#관공서 (구청)", [
        "취득세 신고·납부 (" + won(c.taxTotal) + "원, 60일 이내)",
        "말소분 등록면허세 (" + won(c.erasureTotal) + "원)",
        "납부영수증을 캠코에 제출"
      ]],
      ["#은행", [
        "국민주택채권 매입 " + won(c.bondAmount) + "원",
        "즉시매도 실부담 약 " + won(c.bondCost) + "원"
      ]],
      ["#캠코", [
        "등기(등록)청구서 + 취득세·등록면허세 납부영수증",
        "등기필증 수령 요청서 + 선납 라벨 붙인 대봉투 2개",
        "매수인 인적사항 확인용 주민등록초본"
      ]],
      ["#등기 후", [
        "등기필증 수령, 등기사항전부증명서 확인",
        "점유자 명도·인도명령"
      ]]
    ];
  }

  function docChecklist(s, c) {
    var groups = checklist(s, c);
    var body = '<p class="doc-body">' + esc(
      s.type === "sale" ? "일반매매 셀프등기 순서입니다. 위에서부터 확인하며 지우면 빠뜨리지 않습니다."
        : s.type === "auction" ? "경매 낙찰 후 등기 순서입니다. 법원 → 구청 → 은행 → 등기소 순으로 돈과 서류가 오갑니다."
          : "공매(온비드) 낙찰 후 등기 순서입니다. 캠코에 청구하고, 세금은 구청·위택스에서 냅니다."
    ) + '</p>'
      + costTable(s, c)
      + groups.map(function (g) {
        return '<h4 class="doc-sub">' + esc(g[0].slice(1)) + '</h4>' + list(g[1], true);
      }).join("");
    return sheet("checklist", "제출서류 체크리스트", (s.type === "sale" ? "일반매매" : s.type === "auction" ? "경매" : "공매") + " · 관공서·법원·은행", body);
  }

  /* ============================================================
     문서 모음
     ============================================================ */
  function buildDocs(s, c) {
    var out = [];
    if (s.type === "sale") {
      out.push(sheet("app-sale", "소유권이전등기신청서", "매매 · 부동산 1건",
        '<table class="doc-t"><tbody><tr><th class="doc-l">접수</th><td>　　　년 　월 　일 제 　　　호</td><th class="doc-l">처리인</th><td>등기관 확인 · 각종 통지</td></tr></tbody></table>'
        + '<h4 class="doc-sub">부동산의 표시</h4>'
        + rows([
          r("소재지·표시", addrBlock(s)),
          r("거래신고관리번호", v(s.dealNo)),
          r("거래가액", money(s.amount) + " (" + illGeum(s.amount) + ")"),
          r("등기원인과 그 연월일", dateCell(s.date1) + " 매매"),
          r("등기의 목적", "소유권이전"),
          r("이전할 지분", "전부")
        ])
        + '<h4 class="doc-sub">당사자</h4>' + partyTable(s)
        + '<h4 class="doc-sub">시가표준액 및 국민주택채권매입금액</h4>' + bondTable(s, c)
        + '<h4 class="doc-sub">세액</h4>' + taxTable(s, c)
        + '<h4 class="doc-sub">등기의무자의 등기필정보</h4>' + deedInfoTable(s)
        + '<h4 class="doc-sub">첨부서면</h4>'
        + list([
          "매매계약서(전자수입인지 첨부) 1통",
          "취득세(등록면허세) 영수필확인서 1통",
          "등기신청수수료 영수필확인서 1통",
          "위임장 1통",
          "등기필증 1통",
          "토지·임야·건축물대장등본 각 1통",
          "주민등록표초본(또는 등본) 1통",
          "부동산거래계약신고필증 1통",
          "매매목록 1통",
          "인감증명서 또는 본인서명사실확인서 발급증 1통"
        ])
        + signBlock(kdate(s.date2), [
          '위 신청인 <span class="doc-line">' + (vv(s.buyerName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> <span class="doc-stamp">(인)</span>',
          '(또는) 위 대리인 <span class="doc-line">' + (vv(s.agentName) || "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;") + '</span> (전화 : ' + (vv(s.agentTel) || vv(s.buyerTel) || "") + ')'
        ], "○○지방법원 등기소 귀중")));
      out.push(docPower(s));
      out.push(docAcqTax(s, c));
      out.push(docReceipt(s));
      out.push(docChecklist(s, c));
      return out;
    }
    if (s.type === "auction" && s.mode === "chuktak") {
      out.push(docPaid(s, c));
      out.push(docEntrust(s, c));
      out.push(docPropertyList(s));
      out.push(docErasures(s));
      out.push(docAcqTax(s, c));
      out.push(docMail(s));
      out.push(docPower(s));
      out.push(docChecklist(s, c));
      return out;
    }
    if (s.type === "auction") {
      out.push(docPaid(s, c));
      out.push(docAuctionDirect(s, c));
      out.push(docEraseApp(s, c));
      out.push(docAcqTax(s, c));
      out.push(docRegTax(s, c));
      out.push(docPower(s));
      out.push(docChecklist(s, c));
      return out;
    }
    out.push(docGongmae(s, c));
    out.push(docCertPickup(s));
    out.push(docAcqTax(s, c));
    out.push(docRegTax(s, c));
    out.push(docPower(s));
    out.push(docChecklist(s, c));
    return out;
  }

  /* ============================================================
     입력값 저장 / 복원
     ============================================================ */
  function collect() {
    var o = { type: TYPE, mode: MODE };
    Object.keys(F).forEach(function (k) {
      var el = $(F[k]);
      if (!el) return;
      o[k] = el.type === "checkbox" ? el.checked : el.value;
    });
    var radios = root.querySelectorAll('input[name="auctionMode"]');
    for (var i = 0; i < radios.length; i++) if (radios[i].checked) o.mode = radios[i].value;
    return o;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(collect())); } catch (e) {}
  }
  function restore() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) return false;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return false; }
    if (!o || !o.type) return false;
    TYPE = o.type === "auction" || o.type === "gongmae" ? o.type : "sale";
    MODE = o.mode === "direct" ? "direct" : "chuktak";
    Object.keys(F).forEach(function (k) {
      var el = $(F[k]);
      if (!el || !(k in o)) return;
      if (el.type === "checkbox") el.checked = !!o[k];
      else el.value = o[k];
    });
    var radios = root.querySelectorAll('input[name="auctionMode"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === MODE;
    return true;
  }

  /* ============================================================
     렌더
     ============================================================ */
  var LABELS = {
    sale: { amount: "거래가액", d1: "매매 계약일", d2: "잔금 완납일" },
    auction: { amount: "매각대금(낙찰가)", d1: "매각기일(낙찰일)", d2: "잔금 납부일" },
    gongmae: { amount: "매각대금(납부금액)", d1: "매각결정일", d2: "대금 납부일" }
  };

  function syncUI() {
    var lb = LABELS[TYPE];
    var a = $("#lbAmount"), d1 = $("#lbDate1"), d2 = $("#lbDate2");
    if (a) a.textContent = lb.amount;
    if (d1) d1.textContent = lb.d1;
    if (d2) d2.textContent = lb.d2;

    $$("[data-show]").forEach(function (el) {
      var list = el.getAttribute("data-show").split(",");
      el.hidden = list.indexOf(TYPE) === -1;
    });
    $$("[data-show-mode]").forEach(function (el) {
      el.hidden = TYPE !== "auction" || el.getAttribute("data-show-mode") !== MODE;
    });
    $$(".type-card").forEach(function (b) {
      var on = b.getAttribute("data-type") === TYPE;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    var houseOnly = $("#houseOnly");
    if (houseOnly) houseOnly.hidden = val("kind") !== "house";
    var firstOpt = $("#firstLimitField");
    if (firstOpt) firstOpt.hidden = !chk("first");

    // 보이는 블록만 1,2,3… 으로 번호 매김
    var no = 0;
    $$(".deed-block").forEach(function (b) {
      if (b.hidden) return;
      var tag = b.querySelector(".deed-block__t span");
      if (tag) tag.textContent = ++no;
    });
  }

  var timer = null;
  function render(now) {
    if (timer) clearTimeout(timer);
    var run = function () {
      timer = null;
      syncUI();
      var s = readState();
      var c = calc(s);
      renderSum(s, c);
      var docs = $("#deedDocs");
      if (docs) docs.innerHTML = buildDocs(s, c).join("");
      save();
    };
    if (now) run(); else timer = setTimeout(run, 140);
  }

  /* ============================================================
     이벤트
     ============================================================ */
  $$(".type-card").forEach(function (btn) {
    btn.addEventListener("click", function () {
      TYPE = btn.getAttribute("data-type");
      render(true);
    });
  });

  $$('input[name="auctionMode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      MODE = r.value;
      render(true);
    });
  });

  $("#deedForm").addEventListener("input", function (ev) {
    var t = ev.target;
    if (t && t.classList && t.classList.contains("js-money")) fmtInput(t);
    render();
  });
  $("#deedForm").addEventListener("change", function () { render(); });
  $("#deedForm").addEventListener("submit", function (ev) { ev.preventDefault(); });

  var printBtn = $("#deedPrint");
  if (printBtn) printBtn.addEventListener("click", function () {
    window.print();
  });

  var copyBtn = $("#deedCopy");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    var sheets = $$("#deedDocs .doc-sheet");
    var text = sheets.map(function (s) { return (s.innerText || "").trim(); }).join("\n\n────────────────\n\n");
    var done = function () {
      var old = copyBtn.textContent;
      copyBtn.textContent = "복사됨";
      setTimeout(function () { copyBtn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else fallbackCopy(text, done);
  });
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  var resetBtn = $("#deedReset");
  if (resetBtn) resetBtn.addEventListener("click", function () {
    if (!window.confirm("입력한 내용을 모두 지웁니다. 저장된 값도 함께 삭제됩니다.")) return;
    $("#deedForm").reset();
    try { localStorage.removeItem(KEY); } catch (e) {}
    TYPE = "sale"; MODE = "chuktak";
    $$('input[name="auctionMode"]').forEach(function (r) { r.checked = r.value === "chuktak"; });
    render(true);
  });

  /* 예시값 (가상 인물·금액) */
  var SAMPLE = {
    sale: {
      addr: "서울특별시 송파구 가락로 71, 403호",
      display: "철근콘크리트조 84.74㎡\n대지권 비율 49,671.6분의 43.10",
      uniq: "1173-2026-0001", kind: "house", area: "84.74", std: "620,000,000",
      amount: "1,150,000,000", date1: "2026-11-02", date2: "2026-12-28",
      dealNo: "2026-1173-0001",
      sellerName: "김매도", sellerRrn: "700101-1000000", sellerAddr: "서울특별시 송파구 가락로 71, 403호", sellerTel: "010-0000-0001",
      buyerName: "홍즐부", buyerRrn: "810228-1000000", buyerAddr: "서울특별시 송파구 올림픽로 300, 101동 1001호", buyerTel: "010-0000-0002",
      agentName: "박대리", agentTel: "010-0000-0003", agentAddr: "서울특별시 송파구 가락로 71, 404호"
    },
    auction: {
      addr: "서울특별시 서초구 양재동 000-0, 1동 2층 201호",
      display: "철근콘크리트조 59.82㎡\n대지권 비율 218.75분의 18.18",
      uniq: "1173-2025-0456", kind: "house", area: "59.82", std: "430,000,000",
      amount: "320,000,000", date1: "2026-11-18", date2: "2026-12-24",
      court: "서울동부지방법원", caseNo: "2025타경105432",
      creditor: "○○신용협동조합", debtor: "김채무", owner: "김채무",
      erasures: "3", erasureList: "갑구 3번 | 압류 | 2025. 3. 6. | 802563 | 채권자 ○○세무서\n갑구 4번 | 가압류 | 2025. 9. 3. | 156563 | 채권자 신용보증기금\n을구 11번 | 근저당권설정 | 2024. 7. 9. | 116759 | 채권최고액 3억원",
      buyerName: "홍즐부", buyerRrn: "810228-1000000", buyerAddr: "서울특별시 송파구 올림픽로 300, 101동 1001호", buyerTel: "010-0000-0002",
      agentName: "박대리", agentTel: "010-0000-0003", agentAddr: "서울특별시 송파구 가락로 71, 404호"
    },
    gongmae: {
      addr: "서울특별시 송파구 석촌동 000 대 120.0㎡",
      display: "대 120.0㎡ (지목: 대)",
      uniq: "1173-2024-0789", kind: "land", area: "120", std: "380,000,000",
      amount: "210,000,000", date1: "2026-11-20", date2: "2026-12-22",
      disposer: "○○세무서", manageNo: "2026-0001-001",
      gmDebtor: "김체납", gmRrn: "781021-1000000", gmAddr: "서울특별시 노원구 노해로 00",
      erasures: "2", erasureList: "갑구 2번 | 압류 | 2024. 5. 2. | 231144 | 채권자 ○○세무서\n을구 5번 | 근저당권설정 | 2022. 8. 19. | 445120 | 채권최고액 1억원",
      buyerName: "홍즐부", buyerRrn: "810228-1000000", buyerAddr: "서울특별시 송파구 올림픽로 300, 101동 1001호", buyerTel: "010-0000-0002",
      agentName: "박대리", agentTel: "010-0000-0003", agentAddr: "서울특별시 송파구 가락로 71, 404호"
    }
  };
  var sampleBtn = $("#deedSample");
  if (sampleBtn) sampleBtn.addEventListener("click", function () {
    var d = SAMPLE[TYPE] || SAMPLE.sale;
    Object.keys(d).forEach(function (k) {
      var el = $(F[k]);
      if (!el) return;
      el.value = d[k];
    });
    if (TYPE !== "sale") {
      var amt = $(F["amount"]);
      if (amt) fmtInput(amt);
    }
    render(true);
  });

  /* 시작 */
  restore();
  render(true);
})();
