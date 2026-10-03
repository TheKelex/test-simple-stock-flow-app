import { useEffect, useState, type FormEvent } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FileBarChart,
  ImagePlus,
  LoaderCircle,
  LogOut,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  ApiError,
  createSale,
  deleteProduct,
  getCategories,
  getProducts,
  getSales,
  getSalesReport,
  login,
  saveProduct,
  uploadProductImage,
  type ProductInput,
} from './infrastructure/http/apiClient';
import type { Category, Product, Sale, SalesReport, Session } from './domain/types';

 type View = 'catalog' | 'sales' | 'reports';
 type CartLine = { product: Product; quantity: number };

const navigation: Array<{ id: View; label: string; icon: typeof Boxes }> = [
  { id: 'catalog', label: 'Catalog', icon: Boxes },
  { id: 'sales', label: 'Sales', icon: ShoppingBag },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
];

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function readSession(): Session | null {
  try {
    const saved = sessionStorage.getItem('ssf.session');
    return saved ? JSON.parse(saved) as Session : null;
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) return 'The API is not reachable. Start the backend and try again.';
  if (error instanceof ApiError && error.status === 401) return 'Your session expired. Sign in again.';
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function App() {
  const [session, setSession] = useState<Session | null>(readSession);
  const [view, setView] = useState<View>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!session) return;
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      getCategories(session.token),
      getProducts(session.token, { search, category: categoryFilter }),
    ]).then(([nextCategories, productResponse]) => {
      if (!active) return;
      setCategories(nextCategories);
      setProducts(productResponse.data);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(getErrorMessage(reason));
      if (reason instanceof ApiError && reason.status === 401) signOut();
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [session, search, categoryFilter]);

  useEffect(() => {
    if (!session || view !== 'sales') return;
    getSales(session.token).then((response) => setSales(response.data))
      .catch((reason: unknown) => setError(getErrorMessage(reason)));
  }, [session, view]);

  function signOut() {
    sessionStorage.removeItem('ssf.session');
    setSession(null);
    setProducts([]);
    setCategories([]);
    setSales([]);
    setCart([]);
    setLastSale(null);
    setReport(null);
    setError('');
    setNotice('');
  }

  function acceptSession(nextSession: Session) {
    sessionStorage.setItem('ssf.session', JSON.stringify(nextSession));
    setSession(nextSession);
    setView('catalog');
    setNotice('Signed in successfully.');
  }

  async function refreshCatalog() {
    if (!session) return;
    const [nextCategories, productResponse] = await Promise.all([
      getCategories(session.token),
      getProducts(session.token, { search, category: categoryFilter }),
    ]);
    setCategories(nextCategories);
    setProducts(productResponse.data);
  }

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing && existing.quantity >= product.stock) return current;
      if (!existing && product.stock < 1) return current;
      return existing
        ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...current, { product, quantity: 1 }];
    });
    setNotice(`${product.name} added to the sale.`);
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.product.id !== productId) return [line];
      const quantity = line.quantity + delta;
      if (quantity < 1) return [];
      return [{ ...line, quantity: Math.min(quantity, line.product.stock) }];
    }));
  }

  async function submitSale() {
    if (!session || cart.length === 0) return;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const sale = await createSale(session.token, cart.map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })));
      setLastSale(sale);
      setCart([]);
      const [productResponse, salesResponse] = await Promise.all([
        getProducts(session.token, { search, category: categoryFilter }),
        getSales(session.token),
      ]);
      setProducts(productResponse.data);
      setSales(salesResponse.data);
      setNotice('Sale recorded. The server confirmed the total and stock update.');
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!session || !window.confirm(`Remove ${product.name} from the active catalog?`)) return;
    setLoading(true);
    setError('');
    try {
      await deleteProduct(session.token, product.id);
      await refreshCatalog();
      setNotice(`${product.name} was removed from the active catalog.`);
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  async function runReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setLoading(true);
    setError('');
    setReport(null);
    try {
      setReport(await getSalesReport(session.token, dateFrom, dateTo));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  if (!session) return <LoginScreen onSignedIn={acceptSession} />;

  const isAdmin = session.user.role === 'admin';
  const cartTotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const activeTitle = navigation.find((item) => item.id === view)?.label ?? 'Catalog';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#catalog" onClick={(event) => { event.preventDefault(); setView('catalog'); }}>
          <span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span>
          <span>stockroom<span className="brand-period">.</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${view === id ? 'active' : ''}`} key={id} onClick={() => setView(id)}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'sales' && cart.length > 0 && <span className="nav-count">{cart.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-chip"><span className="connection-dot" /> API session active</div>
          <div className="profile-row">
            <span className="avatar">{session.user.username.slice(0, 1).toUpperCase()}</span>
            <span className="profile-name"><strong>{session.user.username}</strong><small>{session.user.role}</small></span>
            <button className="icon-button logout-button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ArrowRight size={14} /><strong>{activeTitle}</strong></div>
          <div className="topbar-date"><CalendarDays size={15} /> {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date())}</div>
        </header>

        <div className="page-wrap">
          {error && <div className="notice error-notice" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
          {notice && <div className="notice success-notice" role="status"><Check size={18} /><span>{notice}</span><button className="icon-button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button></div>}

          {view === 'catalog' && (
            <section>
              <div className="page-heading">
                <div><p className="eyebrow">INVENTORY / LIVE CATALOG</p><h1>Products</h1><p className="page-subtitle">Keep your shelves, prices, and availability in sync.</p></div>
                {isAdmin && <button className="button button-primary" onClick={() => { setEditingProduct(null); setShowProductForm(true); }}><PackagePlus size={17} /> Add product</button>}
              </div>
              <div className="metric-strip">
                <div className="metric"><span>Active products</span><strong>{products.length.toString().padStart(2, '0')}</strong></div>
                <div className="metric"><span>Low stock</span><strong className="metric-warning">{products.filter((product) => product.stock < 5).length.toString().padStart(2, '0')}</strong></div>
                <div className="metric"><span>Categories</span><strong>{categories.length.toString().padStart(2, '0')}</strong></div>
                <div className="metric metric-note"><span><Activity size={15} /> Inventory status</span><strong>Updated from API</strong></div>
              </div>
              <div className="toolbar">
                <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
                <label className="select-field"><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><ChevronDown size={15} /></label>
              </div>
              <ProductTable products={products} isAdmin={isAdmin} loading={loading} onEdit={(product) => { setEditingProduct(product); setShowProductForm(true); }} onDelete={removeProduct} />
            </section>
          )}

          {view === 'sales' && (
            <section>
              <div className="page-heading"><div><p className="eyebrow">CHECKOUT / TRANSACTION DESK</p><h1>Sales</h1><p className="page-subtitle">Build a sale and let the server confirm stock and totals.</p></div><span className="role-tag">{session.user.role} account</span></div>
              <div className="sales-layout">
                <div className="sales-products">
                  <div className="section-heading"><h2>Available products</h2><span>{products.length} items</span></div>
                  {products.length === 0 && !loading ? <EmptyState title="No products available" text="Products returned by the API will appear here." /> : products.map((product) => (
                    <div className="sale-product-row" key={product.id}>
                      <div className="product-thumb">{product.image_url ? <img src={product.image_url} alt="" /> : <Boxes size={19} />}</div>
                      <div className="sale-product-info"><strong>{product.name}</strong><span>{product.category?.name ?? 'Uncategorized'} · {product.stock} in stock</span></div>
                      <strong className="sale-price">{money.format(product.price)}</strong>
                      <button className="icon-button add-line-button" title="Add to sale" aria-label={`Add ${product.name} to sale`} disabled={product.stock < 1} onClick={() => addToCart(product)}><Plus size={18} /></button>
                    </div>
                  ))}
                </div>
                <aside className="sale-ticket">
                  <div className="ticket-head"><div><p className="eyebrow">CURRENT ORDER</p><h2>New sale</h2></div><span className="ticket-count">{cart.length} lines</span></div>
                  {cart.length === 0 ? <div className="cart-empty"><ShoppingBag size={25} /><p>Your order is empty</p><span>Add products from the list.</span></div> : <div className="cart-lines">{cart.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div><strong>{product.name}</strong><span>{money.format(product.price)} each</span></div><div className="quantity-stepper"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product.id, -1)}><Minus size={13} /></button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} disabled={quantity >= product.stock} onClick={() => changeQuantity(product.id, 1)}><Plus size={13} /></button></div></div>)}</div>}
                  <div className="ticket-total"><span>Estimated total</span><strong>{money.format(cartTotal)}</strong><small>Final amount is confirmed by the API.</small></div>
                  <button className="button button-primary checkout-button" disabled={cart.length === 0 || loading} onClick={submitSale}>{loading ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />} Confirm sale</button>
                </aside>
              </div>
              {lastSale && <div className="confirmation-panel"><div className="confirmation-icon"><Check size={20} /></div><div><p className="eyebrow">SALE CONFIRMED · {lastSale.id}</p><h2>{money.format(lastSale.total)}</h2><span>{new Date(lastSale.created_at).toLocaleString()} · {lastSale.lines.length} line items</span></div></div>}
              <div className="history-section"><div className="section-heading"><h2>Recent sales</h2><span>Latest 20 transactions</span></div><SalesTable sales={sales} loading={loading} /></div>
            </section>
          )}

          {view === 'reports' && (
            <section>
              <div className="page-heading"><div><p className="eyebrow">ANALYTICS / SALES PERFORMANCE</p><h1>Reports</h1><p className="page-subtitle">A readout of completed sales for the selected period.</p></div></div>
              <form className="report-filter" onSubmit={runReport}><label><span>From</span><input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} required /></label><label><span>To</span><input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} required /></label><button className="button button-dark" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <FileBarChart size={17} />} Run report</button></form>
              {report ? <><div className="report-summary"><div><span>Sales completed</span><strong>{report.totalSales}</strong></div><div><span>Sales amount</span><strong>{money.format(report.totalAmount)}</strong></div><div><span>Reporting period</span><strong>{report.from} <ArrowRight size={15} /> {report.to}</strong></div></div><div className="table-frame"><table><thead><tr><th>Product</th><th>Category</th><th>Units sold</th><th>Sales count</th><th className="align-right">Amount</th></tr></thead><tbody>{report.rows.map((row) => <tr key={`${row.product_id}-${row.category_name}`}><td><strong>{row.product_name}</strong></td><td>{row.category_name}</td><td>{row.units_sold}</td><td>{row.sales_count}</td><td className="align-right">{money.format(row.amount)}</td></tr>)}{report.rows.length === 0 && <tr><td colSpan={5}><EmptyState title="No sales in this period" text="Try a wider date range." /></td></tr>}</tbody></table></div></> : <div className="report-placeholder"><div className="report-art"><FileBarChart size={31} /></div><h2>Choose a reporting period</h2><p>Report totals and rows are aggregated by the API from recorded sales.</p></div>}
            </section>
          )}
        </div>
      </main>

      {showProductForm && isAdmin && <ProductDialog categories={categories} product={editingProduct} token={session.token} onClose={() => setShowProductForm(false)} onSaved={async () => { setShowProductForm(false); await refreshCatalog(); setNotice(editingProduct ? 'Product updated.' : 'Product created.'); }} onFailure={(message) => setError(message)} />}
    </div>
  );
}

function LoginScreen({ onSignedIn }: { onSignedIn: (session: Session) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onSignedIn(await login(username, password));
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page"><div className="login-brand"><span className="brand-mark"><Activity size={19} strokeWidth={2.5} /></span><span>stockroom<span className="brand-period">.</span></span></div><div className="login-content"><div className="login-copy"><p className="eyebrow">SIMPLE STOCK FLOW / OPERATIONS</p><h1>Every item<br />accounted for.</h1><p>Inventory, sales, and reporting in one clear workspace.</p><div className="login-note"><span className="connection-dot" /> Secure sign-in to your workspace</div></div><form className="login-form" onSubmit={submit}><div><p className="eyebrow">WELCOME BACK</p><h2>Sign in</h2><p className="login-form-subtitle">Use your account credentials to continue.</p></div>{error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}<label>Username<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button className="button button-primary login-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : null}Continue <ArrowRight size={17} /></button><small>Credentials are sent directly to the configured API.</small></form></div><footer className="login-footer"><span>SSF / 01</span><span>INVENTORY CONTROL</span><span>API CONNECTED WORKSPACE</span></footer></main>;
}

function ProductTable({ products, isAdmin, loading, onEdit, onDelete }: { products: Product[]; isAdmin: boolean; loading: boolean; onEdit: (product: Product) => void; onDelete: (product: Product) => void }) {
  if (loading && products.length === 0) return <div className="table-frame"><div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading catalog…</div></div>;
  if (products.length === 0) return <div className="table-frame"><EmptyState title="No products found" text="Try another search or clear the category filter." /></div>;
  return <div className="table-frame"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th>{isAdmin && <th className="align-right">Actions</th>}</tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-cell"><div className="product-thumb">{product.image_url ? <img src={product.image_url} alt="" /> : <Boxes size={18} />}</div><div><strong>{product.name}</strong><small>#{product.id.slice(0, 8)}</small></div></div></td><td>{product.category?.name ?? 'Uncategorized'}</td><td>{money.format(product.price)}</td><td><span className={`stock-tag ${product.stock < 5 ? 'low-stock' : ''}`}><span />{product.stock} units</span></td>{isAdmin && <td><div className="row-actions"><button className="text-action" onClick={() => onEdit(product)}>Edit</button><button className="icon-button danger-action" title="Remove product" aria-label={`Remove ${product.name}`} onClick={() => onDelete(product)}><Trash2 size={16} /></button></div></td>}</tr>)}</tbody></table></div>;
}

function SalesTable({ sales, loading }: { sales: Sale[]; loading: boolean }) {
  if (loading && sales.length === 0) return <div className="table-frame"><div className="loading-state"><LoaderCircle className="spin" size={20} /> Loading sales…</div></div>;
  if (sales.length === 0) return <div className="table-frame"><EmptyState title="No sales yet" text="Completed transactions will be listed here." /></div>;
  return <div className="table-frame"><table><thead><tr><th>Sale</th><th>Seller</th><th>Date</th><th>Items</th><th className="align-right">Total</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><strong>#{sale.id.slice(0, 8)}</strong></td><td>{sale.sold_by}</td><td>{new Date(sale.created_at).toLocaleString()}</td><td>{sale.lines.reduce((sum, line) => sum + line.quantity, 0)}</td><td className="align-right">{money.format(sale.total)}</td></tr>)}</tbody></table></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><ClipboardList size={22} /><strong>{title}</strong><span>{text}</span></div>;
}

function ProductDialog({ categories, product, token, onClose, onSaved, onFailure }: { categories: Category[]; product: Product | null; token: string; onClose: () => void; onSaved: () => Promise<void>; onFailure: (message: string) => void }) {
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product?.price.toString() ?? '');
  const [stock, setStock] = useState(product?.stock.toString() ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? product?.category?.id ?? '');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const input: ProductInput = { name: name.trim(), price: Number(price), stock: Number(stock), category_id: categoryId };
      const saved = await saveProduct(token, input, product?.id);
      const productId = saved.id || product?.id;
      if (image && productId) await uploadProductImage(token, productId, image);
      await onSaved();
    } catch (reason) {
      const message = getErrorMessage(reason);
      setError(message);
      onFailure(message);
    } finally {
      setLoading(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title"><header><div><p className="eyebrow">CATALOG / ADMIN</p><h2 id="product-dialog-title">{product ? 'Edit product' : 'Add product'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></header><form onSubmit={submit}><label>Product name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required /></label><div className="form-grid"><label>Price (COP)<input type="number" min="1" step="1" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Stock<input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} required /></label></div><label>Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label><label className="file-drop"><ImagePlus size={18} /><span>{image?.name ?? (product?.image_url ? 'Replace product image' : 'Choose a product image')}</span><input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} /></label>{error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}<footer><button type="button" className="button button-outline" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{product ? 'Save changes' : 'Create product'}</button></footer></form></section></div>;
}

export default App;
