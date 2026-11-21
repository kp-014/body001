/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจาก element ที่มีในหน้า แล้วเริ่มทำงานเฉพาะส่วนที่เกี่ยวข้อง
     - product.html : #filter-bar, #product-list
     - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
     - admin.html   : #ordersTable tbody
   ========================================================== */

var ORDER_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbwDoBe_KLrcwtkLa3PnNqxT2iBecnbNeIkIlqEIOt2IZSIPbrmDVbMekQnEOfwEAyI/exec";

var ORDERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTxHzzhJz7X5Bf-XqiNPO7QEsKhB9TabgeWXNLPE4s_rrcFIl3_EMqoJTXfrlTFoDMQm-nsnRTlXxLq/pub?gid=0&single=true&output=csv";

var MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" }
];

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

/* ----------------------------------------------------------
   ตัวช่วยเล็กๆ
   ---------------------------------------------------------- */
function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/* ==========================================================
   1) หน้า product.html
   ========================================================== */
function initProductPage() {
  var filterBar = document.getElementById("filter-bar");
  var list = document.getElementById("product-list");
  var products = [];

  var params = new URLSearchParams(window.location.search);
  var requested = (params.get("mood") || "all").toLowerCase();
  var activeMood = MOODS.some(function (m) { return m.key === requested; })
    ? requested
    : "all";

  function buildFilterBar() {
    if (!filterBar) return;
    filterBar.textContent = "";
    MOODS.forEach(function (m) {
      var btn = el("button");
      btn.type = "button";
      btn.setAttribute("data-mood", m.key);
      btn.setAttribute("aria-pressed", String(m.key === activeMood));
      if (m.key !== "all") btn.appendChild(el("span", "mood-dot"));
      btn.appendChild(document.createTextNode(m.label));
      btn.addEventListener("click", function () {
        setMood(m.key);
      });
      filterBar.appendChild(btn);
    });
  }

  function setMood(key) {
    activeMood = key;
    Array.prototype.forEach.call(filterBar.querySelectorAll("button"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-mood") === key));
    });

    // อัปเดต URL โดยไม่โหลดหน้าใหม่ เพื่อให้แชร์ลิงก์ที่กรองแล้วได้
    try {
      var url = new URL(window.location.href);
      if (key === "all") url.searchParams.delete("mood");
      else url.searchParams.set("mood", key);
      window.history.replaceState(null, "", url);
    } catch (e) { /* ข้ามได้ ไม่กระทบการทำงาน */ }

    render();
  }

  function createCard(p) {
    var card = el("article", "product-card");
    card.setAttribute("data-mood", p.mood);

    var imgWrap = el("div", "product-card__image");
    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);

    var moodRow = el("div", "product-card__mood");
    moodRow.appendChild(el("span", "mood-dot"));
    var moodInfo = MOODS.filter(function (m) { return m.key === p.mood; })[0];
    moodRow.appendChild(el("span", null, moodInfo ? moodInfo.label : p.mood));
    card.appendChild(moodRow);

    card.appendChild(el("h3", "product-card__name", p.name));
    card.appendChild(el("p", "product-card__meta", p.size ? p.size : "โรลออน"));

    var footer = el("div", "product-card__footer");
    var price = el("span", "price", String(p.price));
    price.appendChild(el("small", null, "บาท"));
    footer.appendChild(price);

    // ชื่อสินค้าที่ส่งไปหน้าสั่งซื้อ = ชื่อ + ไซส์ (ถ้ามี)
    var itemLabel = p.size ? p.name + " " + p.size : p.name;
    var order = el("a", "btn btn--small", "สั่งซื้อ");
    order.href =
      "order.html?item=" + encodeURIComponent(itemLabel) +
      "&price=" + encodeURIComponent(p.price);
    footer.appendChild(order);

    card.appendChild(footer);
    return card;
  }

  function render() {
    list.textContent = "";
    var shown = products.filter(function (p) {
      return activeMood === "all" || p.mood === activeMood;
    });

    if (shown.length === 0) {
      list.appendChild(el("p", null, "ยังไม่มีสินค้าในหมวดนี้"));
      return;
    }

    var grid = el("div", "product-grid");
    shown.forEach(function (p) { grid.appendChild(createCard(p)); });
    list.appendChild(grid);
  }

  buildFilterBar();
  list.appendChild(el("p", null, "กำลังโหลดสินค้า..."));

  fetch("products.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      render();
    })
    .catch(function (err) {
      console.error(err);
      list.textContent = "";
      list.appendChild(el("p", null, "โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"));
    });
}

/* ==========================================================
   2) หน้า order.html
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById("orderForm");
  var itemsInput = document.getElementById("items");
  var totalInput = document.getElementById("total");

  // เติมชื่อสินค้าและราคาจาก URL parameter ทันทีที่โหลดหน้า
  var params = new URLSearchParams(window.location.search);
  var item = params.get("item");
  var price = params.get("price");
  if (item !== null && itemsInput) itemsInput.value = item;
  if (price !== null && totalInput) totalInput.value = price;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var payload = {
      customerName: document.getElementById("customerName").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      items: itemsInput.value.trim(),
      total: totalInput.value.trim(),
      note: document.getElementById("note").value.trim()
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true; // กันกดซ้ำระหว่างส่ง

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) หน้า admin.html
   ========================================================== */

/**
 * แปลงข้อความ CSV เป็น array ของแถว (แต่ละแถวเป็น array ของช่อง)
 * รองรับ: ช่องที่อยู่ใน "..." , "" แทนเครื่องหมาย " ในช่อง,
 * ขึ้นบรรทัดใหม่ภายในช่อง, ตัวคั่นแถวแบบ \n \r\n และ BOM ต้นไฟล์
 */
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // แถวสุดท้ายที่ไม่มีการขึ้นบรรทัดใหม่ปิดท้าย
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function initAdminPage() {
  var tbody = document.querySelector("#ordersTable tbody");
  var COLS = 6;

  function showMessage(msg) {
    tbody.textContent = "";
    var tr = el("tr");
    var td = el("td", null, msg);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function formatTotal(value) {
    var n = Number(String(value).replace(/,/g, ""));
    return value !== "" && isFinite(n) ? n.toLocaleString("th-TH") : value;
  }

  showMessage("กำลังโหลดข้อมูล...");

  fetch(ORDERS_CSV_URL)
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text).filter(function (r) {
        return r.some(function (c) { return c.trim() !== ""; });
      });

      // ถ้าแถวแรกเป็นหัวตาราง (ช่องวันเวลาไม่มีตัวเลขเลย) ให้ข้ามไป
      if (rows.length > 0 && !/\d/.test(rows[0][0] || "")) rows.shift();

      if (rows.length === 0) {
        showMessage("ยังไม่มีคำสั่งซื้อ");
        return;
      }

      // ข้อมูลถูกต่อท้ายตามลำดับเวลา จึงกลับด้านให้ล่าสุดขึ้นก่อน
      rows.reverse();

      tbody.textContent = "";
      rows.forEach(function (r) {
        var tr = el("tr");
        for (var c = 0; c < COLS; c++) {
          var value = (r[c] || "").trim();
          if (c === 4) value = formatTotal(value);
          tr.appendChild(el("td", null, value));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (err) {
      console.error(err);
      showMessage("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    });
}
