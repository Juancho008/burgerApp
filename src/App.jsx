import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import {
  ArrowDown,
  ArrowUpRight,
  Beef,
  CupSoda,
  Flame,
  IceCreamCone,
  Leaf,
  Menu,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import BurgerScene from './BurgerScene'
import './App.css'

const products = {
  burgers: [
    {
      id: 'la-fuego',
      name: 'La Fuego',
      description: 'Carne madurada, cheddar fundido, cebolla morada, tomate y salsa de la casa.',
      price: 12.9,
      img: '/img/burger-classic.png',
      featured: true,
    },
    {
      id: 'doble-smash',
      name: 'Doble Smash',
      description: 'Doble carne con borde crujiente, provolone, bacon jam, rúcula y mayo alioli.',
      price: 15.5,
      img: '/img/burger-double.png',
      featured: true,
    },
    {
      id: 'crispy-chicken',
      name: 'Crispy Chicken',
      description: 'Pollo crocante a las hierbas, lechuga fresca, tomate y mayonesa especiada.',
      price: 11.8,
      img: '/img/burger-chicken.png',
    },
  ],
  drinks: [
    {
      id: 'cola',
      name: 'Cola de la Casa',
      description: 'Bien fría, con hielo y un toque de lima.',
      price: 3.5,
      img: '/img/drink-cola.jpg',
    },
    {
      id: 'shake',
      name: 'Shake de Chocolate',
      description: 'Cremoso, con galleta y salsa de chocolate.',
      price: 5.9,
      img: '/img/drink-shake.jpg',
    },
    {
      id: 'limonada',
      name: 'Limonada Casera',
      description: 'Limones exprimidos al momento, poco dulce.',
      price: 4.2,
      img: '/img/drink-lemonade.jpg',
    },
    {
      id: 'cerveza',
      name: 'Cerveza Artesanal',
      description: 'Rubia local, tirada bien fría.',
      price: 6.5,
      img: '/img/drink-beer.jpg',
    },
  ],
  desserts: [
    {
      id: 'brownie',
      name: 'Brownie al Fuego',
      description: 'Tibio, con chocolate fundido por encima.',
      price: 5.5,
      img: '/img/dessert-brownie.jpg',
    },
    {
      id: 'cheesecake',
      name: 'Cheesecake NY',
      description: 'Clásico neoyorquino con frutos rojos.',
      price: 6.2,
      img: '/img/dessert-cheesecake.jpg',
    },
    {
      id: 'sundae',
      name: 'Sundae de Oreo',
      description: 'Helado, crema, galletas y salsa de chocolate.',
      price: 5.9,
      img: '/img/dessert-sundae.jpg',
    },
  ],
}

const allProducts = [...products.burgers, ...products.drinks, ...products.desserts]

const formatPrice = (value) => `$${value.toFixed(2)}`

function LoadingScreen() {
  const { progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const [forced, setForced] = useState(false)

  useEffect(() => {
    // Salvaguarda: nunca dejar la pantalla de carga más de 8 segundos.
    const timeout = setTimeout(() => setForced(true), 8000)
    return () => clearTimeout(timeout)
  }, [])

  const done = progress >= 100 || forced

  useEffect(() => {
    if (done) {
      const timeout = setTimeout(() => setHidden(true), 700)
      return () => clearTimeout(timeout)
    }
  }, [done])

  if (hidden) return null

  return (
    <div className={`loader ${done ? 'loader--done' : ''}`} role="status" aria-label="Cargando Fuego Burger">
      <span className="loader__mark">F!</span>
      <strong className="loader__title">FUEGO</strong>
      <div className="loader__bar">
        <span style={{ transform: `scaleX(${done ? 1 : Math.min(progress, 100) / 100})` }} />
      </div>
      <span className="loader__percent">{done ? 100 : Math.round(Math.min(progress, 100))}%</span>
      <p className="loader__hint">Encendiendo la parrilla…</p>
    </div>
  )
}

function ProductCard({ product, onAdd, compact = false }) {
  return (
    <article className={`product-card ${compact ? 'product-card--compact' : ''}`}>
      <div className="product-card__photo">
        <img src={product.img} alt={product.name} loading="lazy" decoding="async" />
        {product.featured && (
          <span className="product-card__seal">
            <Star size={13} fill="currentColor" />
            favorita
          </span>
        )}
      </div>
      <div className="product-card__content">
        <div>
          <h3>{product.name}</h3>
          <p>{product.description}</p>
        </div>
        <div className="product-card__footer">
          <strong>{formatPrice(product.price)}</strong>
          <button type="button" aria-label={`Agregar ${product.name} al pedido`} onClick={() => onAdd(product)}>
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  )
}

function loadCart() {
  try {
    const raw = localStorage.getItem('fuego-cart')
    if (!raw) return []
    return JSON.parse(raw).filter((item) => allProducts.some((p) => p.id === item.id))
  } catch {
    return []
  }
}

function App() {
  const [cart, setCart] = useState(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [bump, setBump] = useState(false)
  const [isMobile] = useState(() => window.matchMedia('(max-width: 768px), (pointer: coarse)').matches)
  const scrollProgress = useRef(0)
  const heroRef = useRef(null)

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart])
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.qty * item.price, 0), [cart])

  useEffect(() => {
    localStorage.setItem('fuego-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (cartCount === 0) return
    setBump(true)
    const timeout = setTimeout(() => setBump(false), 350)
    return () => clearTimeout(timeout)
  }, [cartCount])

  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [cartOpen])

  useEffect(() => {
    // Al cargar con un hash (ej. /#bebidas), navegar a esa sección una vez montado el contenido.
    const { hash } = window.location
    if (hash) {
      requestAnimationFrame(() => {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'auto' })
      })
    }
  }, [])

  useEffect(() => {
    let frameId

    const updateScroll = () => {
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        const hero = heroRef.current
        if (!hero) return

        const scrollableDistance = Math.max(hero.offsetHeight - window.innerHeight, 1)
        const progress = Math.min(Math.max(window.scrollY / scrollableDistance, 0), 1)
        scrollProgress.current = progress
        hero.style.setProperty('--hero-progress', progress)
      })
    }

    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('resize', updateScroll)
    }
  }, [])

  const addToCart = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
      }
      return [...current, { id: product.id, name: product.name, price: product.price, img: product.img, qty: 1 }]
    })
  }

  const changeQty = (id, delta) => {
    setCart((current) =>
      current
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0),
    )
  }

  const removeItem = (id) => {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const scrollToMenu = () => {
    document.querySelector('#menu')?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="site-shell">
      <LoadingScreen />

      <a className="skip-link" href="#menu">
        Saltar al menú
      </a>

      <header className="nav">
        <a className="brand" href="#inicio" aria-label="Fuego Burger, inicio">
          <span className="brand__mark">F!</span>
          <span className="brand__name">FUEGO</span>
        </a>

        <button
          className="nav__toggle"
          type="button"
          aria-label="Abrir menú"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          {navOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={`nav__links ${navOpen ? 'nav__links--open' : ''}`} aria-label="Principal">
          <a href="#menu" onClick={() => setNavOpen(false)}>
            Burgers
          </a>
          <a href="#bebidas" onClick={() => setNavOpen(false)}>
            Bebidas
          </a>
          <a href="#postres" onClick={() => setNavOpen(false)}>
            Postres
          </a>
          <a href="#historia" onClick={() => setNavOpen(false)}>
            Nuestra cocina
          </a>
        </nav>

        <button
          className={`cart-button ${bump ? 'cart-button--bump' : ''}`}
          type="button"
          aria-label={`Abrir pedido, ${cartCount} productos`}
          onClick={() => setCartOpen(true)}
        >
          <ShoppingBag size={18} />
          <span>Pedido</span>
          <b>{cartCount}</b>
        </button>
      </header>

      <main>
        <section className="hero-section" id="inicio" ref={heroRef}>
          <div className="hero-sticky">
            <div className="hero-glow" aria-hidden="true" />
            <div className="canvas-wrap" aria-label="Hamburguesa tridimensional rotatoria">
              <Canvas
                camera={{ position: [0, 0.25, 11], fov: 34 }}
                dpr={isMobile ? [1, 1.4] : [1, 1.7]}
                gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
                shadows={!isMobile}
              >
                <Suspense fallback={null}>
                  <BurgerScene scrollProgress={scrollProgress} lowPower={isMobile} />
                </Suspense>
              </Canvas>
            </div>

            <div className="hero-content">
              <div className="hero-copy">
                <p className="eyebrow">
                  <Flame size={15} fill="currentColor" />
                  Fuego real. Sabor sin filtro.
                </p>
                <h1>
                  No hacemos
                  <br />
                  hamburguesas.
                  <br />
                  <em>Creamos antojos.</em>
                </h1>
                <p className="hero-copy__body">
                  Carne sellada al fuego, ingredientes frescos y esa salsa que vas a querer en todo.
                </p>
                <div className="hero-actions">
                  <button className="button button--primary" type="button" onClick={scrollToMenu}>
                    Ver la carta
                    <ArrowDown size={18} />
                  </button>
                  <a className="button button--ghost" href="#historia">
                    Nuestra historia
                  </a>
                </div>
              </div>

              <div className="quality-badge" aria-label="Cien por ciento carne seleccionada">
                <span>100%</span>
                <small>
                  carne
                  <br />
                  seleccionada
                </small>
              </div>

              <div className="scroll-cue" aria-hidden="true">
                <span>Desliza para saborear</span>
                <i>
                  <ArrowDown size={14} />
                </i>
              </div>
            </div>

            <div className="ingredient-notes" aria-hidden="true">
              <span className="ingredient-note ingredient-note--one">Pan brioche tostado</span>
              <span className="ingredient-note ingredient-note--two">Carne a la parrilla</span>
              <span className="ingredient-note ingredient-note--three">Todo fresco. Siempre.</span>
            </div>
          </div>
        </section>

        <section className="menu-section" id="menu">
          <div className="section-heading">
            <div>
              <p className="eyebrow eyebrow--dark">
                <Sparkles size={15} />
                Las favoritas
              </p>
              <h2>
                Elige tu próximo
                <br />
                <em>antojo.</em>
              </h2>
            </div>
            <p>
              Cada burger se prepara al momento, sin atajos y con mucho fuego. Elige una o pruébalas
              todas.
            </p>
          </div>

          <div className="product-grid product-grid--three">
            {products.burgers.map((product) => (
              <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
          </div>

          <div className="subsection" id="bebidas">
            <div className="subsection__heading">
              <p className="eyebrow eyebrow--dark">
                <CupSoda size={15} />
                Para acompañar
              </p>
              <h2>
                Bebidas <em>bien frías.</em>
              </h2>
            </div>
            <div className="product-grid product-grid--four">
              {products.drinks.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} compact />
              ))}
            </div>
          </div>

          <div className="subsection" id="postres">
            <div className="subsection__heading">
              <p className="eyebrow eyebrow--dark">
                <IceCreamCone size={15} />
                El final feliz
              </p>
              <h2>
                Postres <em>sin culpa.</em>
              </h2>
            </div>
            <div className="product-grid product-grid--three">
              {products.desserts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} compact />
              ))}
            </div>
          </div>
        </section>

        <section className="story-section" id="historia">
          <div className="story-visual">
            <div className="story-visual__orb story-visual__orb--one" />
            <div className="story-visual__orb story-visual__orb--two" />
            <div className="grill-mark grill-mark--one" />
            <div className="grill-mark grill-mark--two" />
            <span className="story-visual__label">Desde 2018</span>
            <strong>
              HECHO
              <br />
              CON
              <br />
              <em>FUEGO</em>
            </strong>
          </div>

          <div className="story-copy">
            <p className="eyebrow">
              <Beef size={16} />
              Lo simple, bien hecho
            </p>
            <h2>
              Hay cosas que
              <br />
              no se pueden <em>fingir.</em>
            </h2>
            <p>
              El aroma de una parrilla encendida. El crujido del primer mordisco. Por eso trabajamos
              con productores locales y cocinamos cada pedido desde cero.
            </p>
            <div className="stats">
              <div>
                <strong>100%</strong>
                <span>carne fresca</span>
              </div>
              <div>
                <strong>0</strong>
                <span>congelados</span>
              </div>
              <div>
                <strong>6</strong>
                <span>años de fuego</span>
              </div>
            </div>
          </div>
        </section>

        <section className="promise-strip" aria-label="Nuestros valores">
          <span>
            <Beef size={20} /> Carne seleccionada
          </span>
          <span>
            <Leaf size={20} /> Producto local
          </span>
          <span>
            <Flame size={20} /> Parrilla encendida
          </span>
        </section>

        <section className="visit-section" id="locales">
          <div>
            <p className="eyebrow">
              <Flame size={15} />
              ¿Ya tienes hambre?
            </p>
            <h2>
              Ven por el fuego.
              <br />
              <em>Quédate por el sabor.</em>
            </h2>
          </div>
          <a className="button button--light" href="https://maps.google.com" target="_blank" rel="noreferrer">
            Encontrar un local
            <ArrowUpRight size={18} />
          </a>
        </section>
      </main>

      <footer>
        <a className="brand brand--footer" href="#inicio">
          <span className="brand__mark">F!</span>
          <span className="brand__name">FUEGO</span>
        </a>
        <p>Hamburguesas sin excusas.</p>
        <span>© 2026 Fuego Burger</span>
      </footer>

      <div
        className={`cart-overlay ${cartOpen ? 'cart-overlay--visible' : ''}`}
        onClick={() => setCartOpen(false)}
        aria-hidden="true"
      />
      <aside className={`cart-drawer ${cartOpen ? 'cart-drawer--open' : ''}`} aria-label="Tu pedido" aria-hidden={!cartOpen}>
        <header className="cart-drawer__header">
          <h2>
            Tu pedido <b>{cartCount}</b>
          </h2>
          <button type="button" aria-label="Cerrar pedido" onClick={() => setCartOpen(false)}>
            <X size={20} />
          </button>
        </header>

        {cart.length === 0 ? (
          <div className="cart-drawer__empty">
            <ShoppingBag size={38} />
            <p>Tu pedido está vacío.</p>
            <button
              className="button button--primary"
              type="button"
              onClick={() => {
                setCartOpen(false)
                scrollToMenu()
              }}
            >
              Ver la carta
            </button>
          </div>
        ) : (
          <>
            <ul className="cart-drawer__items">
              {cart.map((item) => (
                <li key={item.id} className="cart-item">
                  <img src={item.img} alt="" loading="lazy" />
                  <div className="cart-item__info">
                    <strong>{item.name}</strong>
                    <span>{formatPrice(item.price)}</span>
                    <div className="cart-item__qty">
                      <button
                        type="button"
                        aria-label={`Quitar una unidad de ${item.name}`}
                        onClick={() => changeQty(item.id, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <b>{item.qty}</b>
                      <button
                        type="button"
                        aria-label={`Agregar una unidad de ${item.name}`}
                        onClick={() => changeQty(item.id, 1)}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="cart-item__end">
                    <strong>{formatPrice(item.price * item.qty)}</strong>
                    <button type="button" aria-label={`Eliminar ${item.name} del pedido`} onClick={() => removeItem(item.id)}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="cart-drawer__footer">
              <div className="cart-drawer__total">
                <span>Total</span>
                <strong>{formatPrice(cartTotal)}</strong>
              </div>
              <button className="button button--primary cart-drawer__checkout" type="button">
                Confirmar pedido
                <ArrowUpRight size={18} />
              </button>
              <p>Retiro en local o delivery al confirmar.</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

export default App
