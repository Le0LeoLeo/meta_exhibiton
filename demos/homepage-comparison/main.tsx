import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight, Monitor, Smartphone, Menu, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../src/app/components/ui/tabs';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../src/app/components/ui/dialog';
import './style.css';

type Style = 'museum' | 'apple';
type Modal = { kind: 'exhibit'; index: number } | { kind: 'create' | 'about' | 'login' } | null;
const exhibits = [
  { title: '城市的片刻', category: '攝影・城市記憶', author: 'META EXB 編輯精選', image: '/assets/gallery.png', detail: '在熟悉的街景裡，尋找仍在生長的故事。透過影像與空間，重新感受城市裡那些容易錯過的日常。', number: '01' },
  { title: '風景之外', category: '繪畫・自然觀察', author: '開放典藏選集', image: '/assets/painting.jpg', detail: '沿著筆觸走進風景。從麥田、天空到流動的色彩，留一點時間給觀看，也留一點空間給想像。', number: '02' },
  { title: '把想像留在這裡', category: '空間・創作實驗', author: 'META EXB 空間提案', image: '/assets/cutaway.png', detail: '作品不只存在於畫框裡。一段動線、一面牆與一個停留的角落，都可以成為創作的一部分。', number: '03' },
];

function App() {
  const [style, setStyle] = useState<Style>(new URLSearchParams(location.search).get('style') === 'apple' ? 'apple' : 'museum');
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [featured, setFeatured] = useState(0);
  const [menu, setMenu] = useState(false);
  const [room, setRoom] = useState(0);
  const scrollTo = (id: string) => { document.getElementById(`${style}-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setMenu(false); };
  const openExhibit = (index: number) => { setRoom(0); setModal({ kind: 'exhibit', index }); };
  const switchStyle = (value: string) => { setStyle(value as Style); setMenu(false); history.replaceState(null, '', `?style=${value}`); };
  const feature = exhibits[featured];

  return <Tabs value={style} onValueChange={switchStyle} className="comparison">
    <div className="comparison-bar">
      <div className="comparison-label"><span className="demo-dot"/>首頁風格比較 <span className="local-label">預覽 DEMO</span></div>
      <TabsList aria-label="選擇首頁風格" className="style-tabs">
        <TabsTrigger className="style-tab" value="museum"><span>A</span> 展覽館風格</TabsTrigger>
        <TabsTrigger className="style-tab" value="apple"><span>B</span> Apple 風格</TabsTrigger>
      </TabsList>
      <div className="viewport-controls" aria-label="預覽寬度">
        <button className={!mobile ? 'selected' : ''} onClick={() => setMobile(false)} aria-pressed={!mobile} aria-label="桌面版"><Monitor size={17}/></button>
        <button className={mobile ? 'selected' : ''} onClick={() => setMobile(true)} aria-pressed={mobile} aria-label="手機版"><Smartphone size={17}/></button>
      </div>
    </div>
    <div className={`preview-surround ${mobile ? 'mobile-preview' : ''}`}>
      <div className="site-frame">
        {(['museum', 'apple'] as const).map(variant => <TabsContent value={variant} key={variant} className={`site ${variant}`}>
          <header className="site-header">
            <button className="brand" onClick={() => scrollTo('top')} aria-label="Meta EXB 回到首頁">META EXB<span className="brand-caption">藝術無界<br/>展覽在此</span></button>
            <nav className="desktop-nav" aria-label="主要導覽"><button onClick={() => scrollTo('exhibitions')}>探索展覽</button>{variant === 'apple' && <button onClick={() => setModal({ kind: 'create' })}>建立展覽</button>}<button onClick={() => setModal({ kind: 'about' })}>關於平台</button></nav>
            <div className="header-actions"><button className="login" onClick={() => setModal({ kind: 'login' })}>登入</button>{variant === 'museum' && <button className="primary small" onClick={() => setModal({ kind: 'create' })}>建立展覽</button>}<button className="menu-button" aria-label={menu ? '關閉導覽' : '開啟導覽'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={21}/> : <Menu size={21}/>}</button></div>
            {menu && <nav className="mobile-menu" aria-label="手機導覽"><button onClick={() => scrollTo('exhibitions')}>探索展覽 <ArrowUpRight size={18}/></button><button onClick={() => { setMenu(false); setModal({ kind: 'create' }); }}>建立展覽 <ArrowRight size={18}/></button><button onClick={() => { setMenu(false); setModal({ kind: 'about' }); }}>關於平台</button></nav>}
          </header>
          <main id={`${variant}-top`}>
            {variant === 'museum' ? <section className="museum-hero">
              <div className="museum-intro"><p className="eyebrow">本期展覽 <span>/ FEATURED EXHIBITION</span></p><h1>在日常裡，<br/>重新看見。</h1><p className="hero-description">一場關於城市、記憶與生活的線上展覽。</p><div className="hero-actions"><button className="primary dark" onClick={() => openExhibit(featured)}>進入展覽 <ArrowUpRight size={18}/></button><button className="text-link" onClick={() => setModal({ kind: 'create' })}>建立你的展覽 <ArrowRight size={17}/></button></div><p className="vertical-note">ART<br/>LIVES<br/>FURTHER<br/>ONLINE <span>—</span></p></div>
              <div className="museum-feature"><button className="hero-image-button" onClick={() => openExhibit(featured)} aria-label={`預覽${feature.title}`}><img className={`museum-image slide-${featured}`} src={feature.image} alt={featured === 0 ? '陽光灑入混凝土展場，畫作與長椅沿動線排列' : feature.title}/><span className="image-visit">走進展覽 <ArrowUpRight size={18}/></span></button><div className="feature-caption"><span>{feature.number} — {feature.title}</span><span className="feature-category">{feature.category}</span><div className="carousel-controls"><span>0{featured + 1}<i> / 03</i></span><button aria-label="上一個主打展覽" onClick={() => setFeatured((featured + 2) % 3)}><ChevronLeft size={19}/></button><button aria-label="下一個主打展覽" onClick={() => setFeatured((featured + 1) % 3)}><ChevronRight size={19}/></button></div></div></div>
            </section> : <section className="apple-hero"><p className="eyebrow">讓作品被看見</p><h1>你的作品。<br/>一個值得走進的世界。</h1><p className="hero-description">把照片、創作與回憶，<wbr/>變成可以親身探索的線上展覽。</p><div className="hero-actions"><button className="primary" onClick={() => setModal({ kind: 'create' })}>建立展覽</button><button className="text-link" onClick={() => scrollTo('exhibitions')}>探索展覽 <ArrowUpRight size={18}/></button></div><button className="apple-hero-visual" onClick={() => openExhibit(0)} aria-label="預覽立體展場"><img src="/assets/cutaway.png" alt="白色展場的立體剖面模型，展示畫作、木地板與參觀動線"/><span className="apple-image-visit">走進你的下一個展覽 <ArrowUpRight size={16}/></span></button></section>}
            <section className="exhibitions-section" id={`${variant}-exhibitions`}><div className="section-heading"><div>{variant === 'museum' && <p className="eyebrow">SELECTED EXHIBITIONS</p>}<h2>{variant === 'museum' ? '正在展出' : '好作品，值得慢慢看。'}</h2></div><span className="selection-note">編輯精選 · 3 個展覽</span></div><div className="exhibit-grid">{exhibits.map((exhibit, index) => <button className="exhibit-card" key={exhibit.title} onClick={() => openExhibit(index)}><div className={`exhibit-image image-${index}`}><img loading="lazy" src={exhibit.image} alt={exhibit.title}/><span className="card-arrow"><ArrowUpRight size={22}/></span></div><div className="exhibit-copy"><p className="category">{exhibit.category}</p><h3>{exhibit.title}</h3><p className="card-description">{exhibit.detail.split('。')[0]}。</p><p className="author">{exhibit.author}</p></div></button>)}</div></section>
            <section className="create-section" id={`${variant}-create`}><p className="eyebrow">A SPACE FOR YOUR IDEAS</p><h2>{variant === 'museum' ? '你的作品，也值得一場展覽。' : '從一件作品，開始。'}</h2><p>上傳作品，佈置空間，分享你的故事。</p><button className="primary" onClick={() => setModal({ kind: 'create' })}>開始建立 <ArrowRight size={18}/></button><div className="creation-steps"><span><b>01</b> 上傳作品</span><span><b>02</b> 佈置展場</span><span><b>03</b> 分享世界</span></div></section>
          </main>
          <footer><span className="footer-brand">META EXB</span><span>給每一份創作，一個被看見的空間。</span><small>概念示範 · 展覽內容僅供預覽</small></footer>
        </TabsContent>)}
      </div>
    </div>
    <Dialog open={modal !== null} onOpenChange={open => { if (!open) setModal(null); }}>
      <DialogContent className={`demo-dialog ${style} ${modal?.kind === 'exhibit' ? 'gallery-dialog' : ''}`}>
        <DialogTitle>{modal?.kind === 'exhibit' ? exhibits[modal.index].title : modal?.kind === 'create' ? '從你的第一件作品開始。' : modal?.kind === 'login' ? '歡迎回到 META EXB' : '讓每一份創作，都有自己的空間。'}</DialogTitle>
        <DialogDescription>{modal?.kind === 'exhibit' ? exhibits[modal.index].detail : modal?.kind === 'create' ? '這裡示範建立展覽的入口；你可以先比較兩版的版面與操作感覺。' : modal?.kind === 'login' ? '這是首頁風格 demo，暫不連接正式帳號。關閉後可繼續探索展覽。' : 'META EXB 讓你把照片、畫作與回憶放進線上展場，邀請別人一起走進你的故事。'}</DialogDescription>
        {modal?.kind === 'exhibit' ? <><div className="gallery-preview"><img src={room === 0 ? exhibits[modal.index].image : room === 1 ? '/assets/gallery.png' : '/assets/cutaway.png'} alt={room === 0 ? exhibits[modal.index].title : room === 1 ? '展場內部視角' : '展場全貌'}/></div><div className="room-controls"><button onClick={() => setRoom((room + 2) % 3)} aria-label="上一個展覽視角"><ChevronLeft size={20}/></button><span>{['作品預覽', '展場視角', '空間全貌'][room]} <small>0{room + 1} / 03</small></span><button onClick={() => setRoom((room + 1) % 3)} aria-label="下一個展覽視角"><ChevronRight size={20}/></button></div><p className="demo-disclosure">靜態展覽預覽 · 正式產品提供 3D 自由參觀</p></> : modal?.kind === 'create' ? <div className="create-preview-steps"><div><b>01</b><h3>放入你的作品</h3><p>照片、畫作，或一段值得珍藏的回憶。</p></div><div><b>02</b><h3>給作品一個空間</h3><p>選擇展場，再調整佈置與觀看的順序。</p></div><div><b>03</b><h3>邀請大家走進來</h3><p>分享展覽連結，讓故事繼續發生。</p></div></div> : null}
      </DialogContent>
    </Dialog>
  </Tabs>;
}

createRoot(document.getElementById('root')!).render(<App/>);

