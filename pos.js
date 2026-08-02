const cfg=window.TPG_CONFIG;
const $=s=>document.querySelector(s);
let client=null,user=null,categories=[],menus=[],tables=[],orders=[],history=[],cart=[],currentOrder=null;
const money=n=>`${Math.round(Number(n||0)).toLocaleString()} ກີບ`;
const configured=()=>cfg?.SUPABASE_URL?.startsWith("https://")&&!String(cfg?.SUPABASE_ANON_KEY||"").includes("PASTE_");
function placeholder(label="Menu"){return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="360"><rect width="100%" height="100%" fill="#173e2a"/><text x="50%" y="49%" text-anchor="middle" fill="white" font-family="Arial" font-size="26">${String(label).replace(/[<>&"]/g,"")}</text></svg>`)}

if(configured()) client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
else $("#loginStatus").textContent="กรุณาตรวจ config.js";

async function initSession(){if(!client)return;const {data}=await client.auth.getSession();if(data.session) await enter(data.session.user)}
$("#loginBtn").onclick=async()=>{if(!client)return;$("#loginStatus").textContent="กำลังเข้าสู่ระบบ...";const {data,error}=await client.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error)$("#loginStatus").textContent=error.message;else await enter(data.user)};
$("#logoutBtn").onclick=async()=>{await client.auth.signOut();location.reload()};
async function enter(u){user=u;$("#loginPanel").hidden=true;$("#posApp").hidden=false;$("#logoutBtn").hidden=false;$("#posUser").textContent=u.email||"Staff";await Promise.all([loadCategories(),loadMenus(),loadTables(),loadOpenOrders(),loadHistory()]);renderAll()}

document.querySelectorAll("[data-view]").forEach(btn=>btn.onclick=()=>{document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${btn.dataset.view}`));if(btn.dataset.view==="tables")loadOpenOrders();if(btn.dataset.view==="history")loadHistory()});

async function loadCategories(){const {data,error}=await client.from("categories").select("*").eq("active",true).order("sort_order");if(error)throw error;categories=data||[];$("#categoryFilter").innerHTML='<option value="all">ທຸກໝວດ</option>'+categories.map(c=>`<option value="${c.id}">${c.name_lo}</option>`).join("")}
async function loadMenus(){const {data,error}=await client.from("menu_items").select("*,categories(name_lo)").eq("available",true).order("sort_order");if(error)throw error;menus=data||[];renderMenus()}
async function loadTables(){const {data,error}=await client.from("restaurant_tables").select("*").eq("active",true).order("table_number");if(error){alert("กรุณารัน V7-POS-MIGRATION.sql ก่อน\n"+error.message);return}tables=data||[];$("#tableSelect").innerHTML='<option value="">Takeaway</option>'+tables.map(t=>`<option value="${t.id}" data-number="${t.table_number}">${t.table_number}</option>`).join("")}
async function loadOpenOrders(){const {data,error}=await client.from("orders").select("*").in("status",["open","ready_to_pay"]).order("opened_at",{ascending:false});if(error)return console.error(error);orders=data||[];renderTables()}
async function loadHistory(){const {data,error}=await client.from("orders").select("*").eq("status","paid").order("closed_at",{ascending:false}).limit(100);if(error)return console.error(error);history=data||[];renderHistory()}

function filteredMenus(){const q=$("#menuSearch").value.trim().toLowerCase(),cat=$("#categoryFilter").value;return menus.filter(m=>(cat==="all"||m.category_id===cat)&&`${m.name_lo||""} ${m.name_th||""} ${m.name_en||""}`.toLowerCase().includes(q))}
function renderMenus(){$("#menuGrid").innerHTML="";filteredMenus().forEach(m=>{const el=document.createElement("article");el.className="menu-card";el.innerHTML=`<img alt=""><div><h3>${m.name_lo}</h3><strong>${money(m.price)}</strong></div>`;const img=el.querySelector("img");img.onerror=()=>{img.onerror=null;img.src=placeholder(m.name_lo)};img.src=m.image_url||placeholder(m.name_lo);el.onclick=()=>addToCart(m);$("#menuGrid").appendChild(el)})}
$("#menuSearch").oninput=renderMenus;$("#categoryFilter").onchange=renderMenus;
function addToCart(m){const found=cart.find(x=>x.menu_item_id===m.id&&!x.variant);if(found)found.quantity++;else cart.push({menu_item_id:m.id,item_name:m.name_lo,unit_price:Number(m.price),quantity:1,variant:null,note:""});renderCart()}
function changeQty(i,d){cart[i].quantity+=d;if(cart[i].quantity<=0)cart.splice(i,1);renderCart()}
function totals(){const subtotal=cart.reduce((s,x)=>s+x.unit_price*x.quantity,0),discount=Math.max(0,Number($("#discount").value||0)),vatRate=Math.max(0,Number($("#vatRate").value||0)),base=Math.max(0,subtotal-discount),vat=base*vatRate/100;return{subtotal,discount,vatRate,vat,grand:base+vat}}
function renderCart(){$("#cartItems").innerHTML=cart.length?"":'<p class="empty">ເລືອກເມນູຈາກດ້ານຊ້າຍ</p>';cart.forEach((x,i)=>{const row=document.createElement("div");row.className="cart-row";row.innerHTML=`<div><h4>${x.item_name}</h4><small>${money(x.unit_price)} × ${x.quantity} = ${money(x.unit_price*x.quantity)}</small><br><button class="remove">ລົບ</button></div><div class="qty"><button>−</button><b>${x.quantity}</b><button>+</button></div>`;const bs=row.querySelectorAll(".qty button");bs[0].onclick=()=>changeQty(i,-1);bs[1].onclick=()=>changeQty(i,1);row.querySelector(".remove").onclick=()=>{cart.splice(i,1);renderCart()};$("#cartItems").appendChild(row)});const t=totals();$("#subtotal").textContent=money(t.subtotal);$("#vatAmount").textContent=money(t.vat);$("#grandTotal").textContent=money(t.grand)}
$("#discount").oninput=renderCart;$("#vatRate").oninput=renderCart;$("#clearCartBtn").onclick=()=>{if(confirm("ລ້າງລາຍການທັງໝົດ?")){cart=[];renderCart()}};

function generateOrderNo(){const d=new Date(),date=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`,time=`${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}${String(d.getSeconds()).padStart(2,"0")}`;return `TPG-${date}-${time}-${Math.floor(Math.random()*90+10)}`}
async function createOrUpdateOrder(status="open"){
 if(!cart.length)throw new Error("ຍັງບໍ່ມີລາຍການ");const t=totals(),opt=$("#tableSelect").selectedOptions[0],tableId=$("#tableSelect").value||null,tableNumber=tableId?Number(opt.dataset.number):null;
 const payload={table_id:tableId,table_number:tableNumber,status,note:$("#orderNote").value.trim()||null,subtotal:t.subtotal,discount:t.discount,vat_rate:t.vatRate,vat_amount:t.vat,grand_total:t.grand};
 if(currentOrder){const {error}=await client.from("orders").update(payload).eq("id",currentOrder.id);if(error)throw error;await client.from("order_items").delete().eq("order_id",currentOrder.id)}
 else{payload.order_number=generateOrderNo();payload.opened_by=user.id;const {data,error}=await client.from("orders").insert(payload).select().single();if(error)throw error;currentOrder=data}
 const items=cart.map(x=>({...x,order_id:currentOrder.id}));const {error:itemError}=await client.from("order_items").insert(items);if(itemError)throw itemError;
 currentOrder={...currentOrder,...payload};updateOrderBadge();await loadOpenOrders();return currentOrder
}
$("#saveOrderBtn").onclick=async()=>{try{await createOrUpdateOrder("open");alert("ບັນທຶກອໍເດີແລ້ວ")}catch(e){alert(e.message)}};
$("#newOrderBtn").onclick=()=>resetOrder(true);
function resetOrder(confirmFirst=false){if(confirmFirst&&cart.length&&!confirm("ເປີດບິນໃໝ່ ແລະ ລ້າງລາຍການປັດຈຸບັນ?"))return;cart=[];currentOrder=null;$("#orderNote").value="";$("#discount").value=0;$("#vatRate").value=0;updateOrderBadge();renderCart()}
function updateOrderBadge(){$("#orderBadge").textContent=currentOrder?`${currentOrder.order_number} • ໂຕະ ${currentOrder.table_number||"Takeaway"}`:"ຍັງບໍ່ມີບິນ";$("#cartOrderNo").textContent=currentOrder?.order_number||"-"}

async function openExistingOrder(order){const {data,error}=await client.from("order_items").select("*").eq("order_id",order.id).order("created_at");if(error)return alert(error.message);currentOrder=order;cart=(data||[]).map(x=>({menu_item_id:x.menu_item_id,item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity,variant:x.variant,note:x.note||""}));$("#tableSelect").value=order.table_id||"";$("#orderNote").value=order.note||"";$("#discount").value=Number(order.discount||0);$("#vatRate").value=Number(order.vat_rate||0);updateOrderBadge();renderCart();document.querySelector('[data-view="sale"]').click()}
function renderTables(){$("#tableGrid").innerHTML="";tables.forEach(t=>{const o=orders.find(x=>x.table_id===t.id),el=document.createElement("article");el.className=`table-card ${o?(o.status==="ready_to_pay"?"ready":"busy"):""}`;el.innerHTML=`<h3>${t.table_number}</h3><span>${o?(o.status==="ready_to_pay"?"ລໍຖ້າຄິດເງິນ":"ກຳລັງໃຊ້"):`ວ່າງ • ${t.capacity} ຄົນ`}</span>${o?`<p>${money(o.grand_total)}</p>`:""}`;el.onclick=()=>{if(o)openExistingOrder(o);else{$("#tableSelect").value=t.id;resetOrder(false);document.querySelector('[data-view="sale"]').click()}};$("#tableGrid").appendChild(el)})}
$("#refreshTables").onclick=loadOpenOrders;

$("#checkoutBtn").onclick=async()=>{try{await createOrUpdateOrder("ready_to_pay");const t=totals();$("#payTotal").textContent=money(t.grand);$("#receivedAmount").value=Math.ceil(t.grand);calcChange();$("#checkoutModal").hidden=false}catch(e){alert(e.message)}};
$("#receivedAmount").oninput=calcChange;function calcChange(){const t=totals(),received=Number($("#receivedAmount").value||0);$("#changeAmount").textContent=money(Math.max(0,received-t.grand))}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$("#checkoutModal").hidden=true);
$("#confirmPaymentBtn").onclick=async()=>{try{const t=totals(),received=Number($("#receivedAmount").value||0),method=$("#paymentMethod").value;if(method==="cash"&&received<t.grand)throw new Error("ເງິນຮັບບໍ່ພໍ");const {error:pErr}=await client.from("payments").insert({order_id:currentOrder.id,method,amount:t.grand,received_amount:received,change_amount:Math.max(0,received-t.grand),paid_by:user.id});if(pErr)throw pErr;const {error:oErr}=await client.from("orders").update({status:"paid",closed_by:user.id,closed_at:new Date().toISOString(),...{subtotal:t.subtotal,discount:t.discount,vat_rate:t.vatRate,vat_amount:t.vat,grand_total:t.grand}}).eq("id",currentOrder.id);if(oErr)throw oErr;$("#checkoutModal").hidden=true;showReceipt({...currentOrder,status:"paid",closed_at:new Date().toISOString(),...t});await Promise.all([loadOpenOrders(),loadHistory()])}catch(e){alert(e.message)}};

function showReceipt(order){const t=totals();$("#rOrderNo").textContent=order.order_number;$("#rDate").textContent=new Date().toLocaleString("lo-LA");$("#rTable").textContent=order.table_number||"Takeaway";$("#rItems").innerHTML=cart.map(x=>`<tr><td>${x.item_name}</td><td>${x.quantity}</td><td>${Math.round(x.unit_price*x.quantity).toLocaleString()}</td></tr>`).join("");$("#rSubtotal").textContent=money(t.subtotal);$("#rDiscount").textContent=money(t.discount);$("#rVat").textContent=money(t.vat);$("#rTotal").textContent=money(t.grand);$("#receipt").hidden=false}
$("#printBtn").onclick=()=>window.print();$("#closeReceiptBtn").onclick=()=>{$("#receipt").hidden=true;resetOrder(false)};

function renderHistory(){$("#historyList").innerHTML=history.length?"":'<p class="empty">ຍັງບໍ່ມີບິນ</p>';history.forEach(o=>{const el=document.createElement("article");el.className="history-row";el.innerHTML=`<div><strong>${o.order_number}</strong><br><small>${new Date(o.closed_at||o.created_at).toLocaleString("lo-LA")} • ໂຕະ ${o.table_number||"Takeaway"}</small></div><b>${money(o.grand_total)}</b><button>ເບິ່ງ/ພິມ</button>`;el.querySelector("button").onclick=async()=>{const {data}=await client.from("order_items").select("*").eq("order_id",o.id);cart=(data||[]).map(x=>({item_name:x.item_name,unit_price:Number(x.unit_price),quantity:x.quantity}));$("#discount").value=o.discount||0;$("#vatRate").value=o.vat_rate||0;showReceipt(o)};$("#historyList").appendChild(el)})}
$("#refreshHistory").onclick=loadHistory;
function renderAll(){renderMenus();renderCart();renderTables();renderHistory();updateOrderBadge()}
initSession();
