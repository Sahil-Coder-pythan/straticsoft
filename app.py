import os, secrets
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, abort, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-change-me")
db_url = os.environ.get("DATABASE_URL", "sqlite:///stratic.db").replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
db = SQLAlchemy(app)

MARKETS = {"IN": ("India", "₹"), "US": ("United States", "$"), "AU": ("Australia", "A$")}
CATEGORIES = ["Fashion", "Electronics", "Home", "Grocery", "Beauty", "Other"]

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), unique=True, nullable=False)
    password = db.Column(db.String(300), nullable=False)
    role = db.Column(db.String(10), default="customer")
    country = db.Column(db.String(2), nullable=False)
    shop_name = db.Column(db.String(120))

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    seller_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, default="")
    price = db.Column(db.Numeric(10, 2), nullable=False)
    stock = db.Column(db.Integer, default=0)
    category = db.Column(db.String(40), default="Other")
    country = db.Column(db.String(2), nullable=False)
    active = db.Column(db.Boolean, default=True)
    seller = db.relationship("User")

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    country = db.Column(db.String(2), nullable=False)
    address = db.Column(db.Text, nullable=False)
    total = db.Column(db.Numeric(10, 2))
    created = db.Column(db.DateTime, default=datetime.utcnow)
    items = db.relationship("OrderItem", backref="order")

class OrderItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"))
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"))
    seller_id = db.Column(db.Integer, nullable=False)
    qty = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(20), default="placed")  # placed/accepted/rejected/delivered/cancelled
    product = db.relationship("Product")

with app.app_context():
    db.create_all()

def me():
    return db.session.get(User, session["uid"]) if "uid" in session else None

def market():
    u = me()
    if u: return u.country
    return session.get("market", "IN")

def login_required(role=None):
    def deco(f):
        @wraps(f)
        def w(*a, **k):
            u = me()
            if not u: return redirect(url_for("login"))
            if role and u.role != role: abort(403)
            return f(*a, **k)
        return w
    return deco

@app.before_request
def csrf():
    if "csrf" not in session: session["csrf"] = secrets.token_hex(16)
    if request.method == "POST" and request.form.get("csrf") != session["csrf"]: abort(400)

@app.context_processor
def inject():
    m = market()
    return dict(user=me(), m=m, markets=MARKETS, cur=MARKETS[m][1], categories=CATEGORIES,
                token=session["csrf"], cart_n=sum(session.get("cart", {}).values()))

def visible(pid):
    """Server-side country gate: product must be active and in the viewer's market."""
    p = db.session.get(Product, pid)
    if not p or not p.active or p.country != market(): abort(404)
    return p

@app.route("/")
def index():
    q = Product.query.filter_by(country=market(), active=True)
    s, c, sort = request.args.get("q", "").strip(), request.args.get("cat", ""), request.args.get("sort", "")
    if s: q = q.filter(Product.title.ilike(f"%{s}%"))
    if c in CATEGORIES: q = q.filter_by(category=c)
    q = q.order_by(Product.price.asc() if sort == "low" else Product.price.desc() if sort == "high" else Product.id.desc())
    return render_template("index.html", products=q.all(), s=s, c=c, sort=sort)

@app.route("/market/<code>")
def set_market(code):
    if code in MARKETS and not me(): session["market"] = code  # logged-in users are fixed to their country
    return redirect(url_for("index"))

@app.route("/product/<int:pid>")
def product(pid):
    return render_template("product.html", p=visible(pid))

@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        f = request.form
        email, pw, role, country = f["email"].strip().lower(), f["password"], f.get("role", "customer"), f.get("country")
        if country not in MARKETS or role not in ("customer", "seller") or len(pw) < 8 or "@" not in email:
            flash("Check details (password min 8 chars)."); return redirect(url_for("register"))
        if User.query.filter_by(email=email).first():
            flash("Email already registered."); return redirect(url_for("register"))
        u = User(email=email, password=generate_password_hash(pw), role=role, country=country,
                 shop_name=f.get("shop_name", "").strip() or None)
        db.session.add(u); db.session.commit()
        session["uid"] = u.id
        return redirect(url_for("seller" if role == "seller" else "index"))
    return render_template("auth.html", mode="register")

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        u = User.query.filter_by(email=request.form["email"].strip().lower()).first()
        if u and check_password_hash(u.password, request.form["password"]):
            session["uid"] = u.id
            return redirect(url_for("seller" if u.role == "seller" else "index"))
        flash("Wrong email or password.")
    return render_template("auth.html", mode="login")

@app.route("/logout")
def logout():
    session.pop("uid", None); session.pop("cart", None)
    return redirect(url_for("index"))

# ---- Seller ----
@app.route("/seller")
@login_required("seller")
def seller():
    u = me()
    prods = Product.query.filter_by(seller_id=u.id).order_by(Product.id.desc()).all()
    items = OrderItem.query.filter_by(seller_id=u.id).order_by(OrderItem.id.desc()).all()
    return render_template("seller.html", prods=prods, items=items)

@app.route("/seller/add", methods=["POST"])
@login_required("seller")
def add_product():
    u, f = me(), request.form
    try:
        price, stock = float(f["price"]), int(f["stock"])
        assert price > 0 and stock >= 0 and f["title"].strip()
    except Exception:
        flash("Invalid product data."); return redirect(url_for("seller"))
    db.session.add(Product(seller_id=u.id, title=f["title"].strip()[:150], description=f.get("description", "")[:2000],
                           price=price, stock=stock, category=f.get("category", "Other"), country=u.country))
    db.session.commit()
    return redirect(url_for("seller"))

@app.route("/seller/toggle/<int:pid>", methods=["POST"])
@login_required("seller")
def toggle(pid):
    p = db.session.get(Product, pid)
    if not p or p.seller_id != me().id: abort(404)
    p.active = not p.active; db.session.commit()
    return redirect(url_for("seller"))

@app.route("/seller/item/<int:iid>/<action>", methods=["POST"])
@login_required("seller")
def item_action(iid, action):
    it = db.session.get(OrderItem, iid)
    if not it or it.seller_id != me().id: abort(404)
    flow = {"accept": ("placed", "accepted"), "reject": ("placed", "rejected"), "deliver": ("accepted", "delivered")}
    if action not in flow or it.status != flow[action][0]: abort(400)
    it.status = flow[action][1]
    if action == "reject": it.product.stock += it.qty
    db.session.commit()
    return redirect(url_for("seller"))

# ---- Cart / orders (customers only, same-country only) ----
@app.route("/cart/add/<int:pid>", methods=["POST"])
@login_required("customer")
def cart_add(pid):
    visible(pid)
    c = session.get("cart", {}); c[str(pid)] = c.get(str(pid), 0) + 1
    session["cart"] = c
    return redirect(url_for("cart"))

@app.route("/cart/remove/<int:pid>", methods=["POST"])
@login_required("customer")
def cart_remove(pid):
    c = session.get("cart", {}); c.pop(str(pid), None); session["cart"] = c
    return redirect(url_for("cart"))

def cart_lines():
    lines = []
    for pid, q in session.get("cart", {}).items():
        p = db.session.get(Product, int(pid))
        if p and p.active and p.country == market(): lines.append((p, q))
    return lines

@app.route("/cart")
@login_required("customer")
def cart():
    lines = cart_lines()
    return render_template("cart.html", lines=lines, total=sum(p.price * q for p, q in lines))

@app.route("/checkout", methods=["POST"])
@login_required("customer")
def checkout():
    u, lines, addr = me(), cart_lines(), request.form.get("address", "").strip()
    if not lines or len(addr) < 10:
        flash("Cart empty or address too short."); return redirect(url_for("cart"))
    for p, q in lines:
        if p.stock < q: flash(f"Not enough stock: {p.title}"); return redirect(url_for("cart"))
    o = Order(customer_id=u.id, country=u.country, address=addr, total=sum(p.price * q for p, q in lines))
    db.session.add(o); db.session.flush()
    for p, q in lines:
        p.stock -= q
        db.session.add(OrderItem(order_id=o.id, product_id=p.id, seller_id=p.seller_id, qty=q, price=p.price))
    db.session.commit(); session["cart"] = {}
    return redirect(url_for("orders"))

@app.route("/orders")
@login_required("customer")
def orders():
    return render_template("orders.html", orders=Order.query.filter_by(customer_id=me().id).order_by(Order.id.desc()).all())

@app.route("/orders/cancel/<int:iid>", methods=["POST"])
@login_required("customer")
def cancel(iid):
    it = db.session.get(OrderItem, iid)
    if not it or it.order.customer_id != me().id or it.status != "placed": abort(400)
    it.status = "cancelled"; it.product.stock += it.qty; db.session.commit()
    return redirect(url_for("orders"))

if __name__ == "__main__":
    app.run(debug=True)
