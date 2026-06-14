/**
 * main.js — MD3 下载站主逻辑
 *
 * 依赖：
 * - window.SITE_CONFIG (由 config.js 加载 page/config.json)
 * - 每个项目在 file/<project>/main.json 中定义
 */

// ============================================================
// 全局状态
// ============================================================
const STATE = {
    currentTheme: 'dark',
    projects: {},           // { projectId: ProjectData }
    activeCategory: 'all',
    searchQuery: '',
    detailProjectId: null,
    primaryColor: null,     // hex string like "#4AA26F"
    colorTokens: {}         // { light: {primary, onPrimary, container, onContainer, inverse}, dark: {...} }
};

// ============================================================
// 工具函数
// ============================================================
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function showSnackbar(text, duration = 3000) {
    const bar = $('#snackbar');
    $('.md3-snackbar__text', bar).textContent = text;
    bar.classList.add('md3-snackbar--visible');
    clearTimeout(bar._timer);
    bar._timer = setTimeout(() => bar.classList.remove('md3-snackbar--visible'), duration);
}

function formatFileSize(bytes) {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024;
        i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
}

function detectPlatform() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
    if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux';
    return 'unknown';
}

// ============================================================
// 主题切换
// ============================================================
function initTheme() {
    const cfg = window.SITE_CONFIG?.site?.theme;
    STATE.currentTheme = cfg?.default || 'dark';

    // 读取 localStorage 覆盖
    const saved = localStorage.getItem('md3-theme');
    if (saved) STATE.currentTheme = saved;

    applyTheme();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', STATE.currentTheme);
    localStorage.setItem('md3-theme', STATE.currentTheme);

    const icon = $('#theme-toggle .material-symbols-outlined');
    if (icon) {
        icon.textContent = STATE.currentTheme === 'dark' ? 'dark_mode' : 'light_mode';
    }

    // 应用当前主题对应的颜色
    applyColorTokens();
}

function toggleTheme() {
    STATE.currentTheme = STATE.currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme();
}

// ============================================================
// 动态颜色设置（从 config.json 读取 primaryColor）
// ============================================================
function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(c => {
        const v = Math.max(0, Math.min(255, Math.round(c)));
        return v.toString(16).padStart(2, '0');
    }).join('');
}

function mixColors(hex1, hex2, ratio) {
    const a = hexToRgb(hex1);
    const b = hexToRgb(hex2);
    return rgbToHex(
        a.r + (b.r - a.r) * ratio,
        a.g + (b.g - a.g) * ratio,
        a.b + (b.b - a.b) * ratio
    );
}

/** 判断亮度：返回 0-255，>128 为浅色 */
function luminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** 根据主色 hex 计算出亮色/暗色两组令牌，存入 STATE.colorTokens */
function computeColorTokens(hex) {
    const lum = luminance(hex);

    const light = {
        primary: hex,
        onPrimary: lum > 160 ? '#1a1c20' : '#ffffff',
        container: mixColors(hex, '#ffffff', 0.85),
        onContainer: mixColors(hex, '#000000', 0.58),
        inverse: hex
    };

    const darkPrimary = mixColors(hex, '#ffffff', 0.45);
    const dark = {
        primary: darkPrimary,
        onPrimary: lum > 160 ? '#1a1c20' : '#000000',
        container: mixColors(hex, '#000000', 0.55),
        onContainer: mixColors(hex, '#ffffff', 0.70),
        inverse: darkPrimary
    };

    STATE.colorTokens = { light, dark };
}

/** 把 STATE.colorTokens 中当前主题的颜色写入 CSS 变量 */
function applyColorTokens() {
    const tokens = STATE.currentTheme === 'dark'
        ? STATE.colorTokens.dark
        : STATE.colorTokens.light;
    if (!tokens) return;

    const $root = document.documentElement;
    $root.style.setProperty('--md-sys-color-primary', tokens.primary);
    $root.style.setProperty('--md-sys-color-on-primary', tokens.onPrimary);
    $root.style.setProperty('--md-sys-color-primary-container', tokens.container);
    $root.style.setProperty('--md-sys-color-on-primary-container', tokens.onContainer);
    $root.style.setProperty('--md-sys-color-inverse-primary', tokens.inverse);
}

function applyPrimaryColor(hex) {
    if (!hex || hex === STATE.primaryColor) return;
    STATE.primaryColor = hex;
    computeColorTokens(hex);
    applyColorTokens();
}

// ============================================================
// 站点初始化
// ============================================================
async function initSite() {
    // 等待配置加载
    while (!window.SITE_CONFIG) {
        await new Promise(r => setTimeout(r, 50));
    }

    const cfg = window.SITE_CONFIG;

    // 应用主颜色
    applyPrimaryColor(cfg.site?.primaryColor);

    // 渲染站点名称和描述
    $('#site-name').textContent = cfg.site?.name || 'My Downloads';
    $('#site-desc').textContent = cfg.site?.description || '下载中心';
    document.title = cfg.site?.name || 'My Downloads';

    // 渲染 footer
    const footerCopy = $('#footer-copyright');
    if (footerCopy) footerCopy.textContent = cfg.footer?.copyright || '';

    const footerLinks = $('#footer-links');
    if (footerLinks && cfg.footer?.links?.length) {
        footerLinks.innerHTML = cfg.footer.links
            .map(l => `<a href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`)
            .join('');
    }

    // 加载所有项目
    await loadAllProjects();

    // 收集分类
    const categories = new Set();
    Object.values(STATE.projects).forEach(p => {
        if (p.category) categories.add(p.category);
    });
    const categoryList = ['all', ...categories];

    // 渲染分类筛选按钮
    const filterChips = $('#category-filters');
    filterChips.innerHTML = categoryList
        .map(c => `<button class="md3-filter-chip${c === 'all' ? ' md3-filter-chip--selected' : ''}" data-category="${c}">${c === 'all' ? '全部' : c}</button>`)
        .join('');

    // 渲染项目卡片
    renderProjectCards();

    // 绑定事件
    bindEvents();
}

// ============================================================
// 加载项目数据
// ============================================================
async function loadAllProjects() {
    const projectIds = window.SITE_CONFIG?.projects || [];
    const loads = projectIds.map(async (id) => {
        try {
            const res = await fetch(`../file/${id}/main.json`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            STATE.projects[id] = await res.json();
        } catch (err) {
            console.warn(`[Main] 加载项目 "${id}" 失败:`, err);
        }
    });
    await Promise.all(loads);
}

// ============================================================
// 渲染项目卡片
// ============================================================
function renderProjectCards() {
    const grid = $('#project-cards');
    const entries = Object.entries(STATE.projects);

    // 筛选
    let filtered = entries;
    if (STATE.activeCategory !== 'all') {
        filtered = filtered.filter(([, p]) => p.category === STATE.activeCategory);
    }
    if (STATE.searchQuery) {
        const q = STATE.searchQuery.toLowerCase();
        filtered = filtered.filter(([id, p]) => {
            return (
                (p.name && p.name.toLowerCase().includes(q)) ||
                (p.description && p.description.toLowerCase().includes(q)) ||
                (id.toLowerCase().includes(q)) ||
                (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
            );
        });
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="md3-empty-state">
                <span class="material-symbols-outlined">search_off</span>
                <div class="md3-empty-state__title">没有找到项目</div>
                <div class="md3-empty-state__desc">尝试调整搜索条件或筛选器</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered
        .map(([projectId, project]) => {
            const platforms = project.platforms || [];
            const platformLabels = {
                windows: 'Windows',
                macos: 'macOS',
                linux: 'Linux'
            };
            const platformIcons = {
                windows: 'window',
                macos: 'laptop_mac',
                linux: 'terminal'
            };

            const badges = platforms
                .map(p => `<span class="md3-card__badge md3-badge--${p}"><span class="material-symbols-outlined">${platformIcons[p] || 'devices'}</span>${platformLabels[p] || p}</span>`)
                .join('');

            const fileCount = project.files?.length || 0;
            const latestVersion = project.version || '?';

            return `
                <div class="md3-card md3-ripple" data-project="${projectId}">
                    <div class="md3-card__content">
                        <div class="md3-card__headline">${escapeHtml(project.name || projectId)}</div>
                        <div class="md3-card__subhead">${escapeHtml(project.description || '暂无描述')}</div>
                        <div class="md3-card__meta">${badges}</div>
                    </div>
                    <div class="md3-card__actions">
                        <span class="md3-card__version">v${latestVersion} · ${fileCount} 个文件</span>
                        <button class="md3-button md3-button--tonal md3-button--small" data-action="detail" data-project="${projectId}">
                            详情
                        </button>
                    </div>
                </div>
            `;
        })
        .join('');

    // 添加涟漪效果
    $$('.md3-ripple', grid).forEach(el => {
        el.addEventListener('pointerdown', createRipple);
    });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
// 涟漪动画
// ============================================================
function createRipple(e) {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'md3-ripple-effect';
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
}

// ============================================================
// 详情面板
// ============================================================
function openDetail(projectId) {
    STATE.detailProjectId = projectId;
    const project = STATE.projects[projectId];
    if (!project) return;

    const panel = $('#detail-panel');
    const body = $('#detail-body');

    const platforms = project.platforms || [];
    const platformBadges = platforms
        .map(p => `<span class="md3-card__badge md3-badge--${p}">${p}</span>`)
        .join('');

    const tagBadges = (project.tags || [])
        .map(t => `<span class="md3-card__badge">${t}</span>`)
        .join('');

    // 文件列表
    const currentPlatform = detectPlatform();
    const files = project.files || [];
    const downloadList = files
        .map(f => {
            const isRecommended = f.platform === currentPlatform;
            const icon = f.type === 'dmg' ? 'laptop_mac' :
                         f.type === 'appimage' ? 'terminal' :
                         'download';
            return `
                <div class="md3-download-item">
                    <span class="material-symbols-outlined" style="color:var(--md-sys-color-primary)">${icon}</span>
                    <div class="md3-download-item__info">
                        <div class="md3-download-item__name">${escapeHtml(f.name)}${isRecommended ? ' <span style="color:var(--md-sys-color-primary);font-size:11px;">推荐</span>' : ''}</div>
                        <div class="md3-download-item__size">${f.size || ''} · ${f.platform} · ${f.arch || ''}</div>
                    </div>
                    <div class="md3-download-item__actions">
                        <a href="${f.url}" class="md3-button md3-button--filled md3-button--small" download>
                            <span class="material-symbols-outlined">download</span>
                            下载
                        </a>
                    </div>
                </div>
            `;
        })
        .join('');

    // 更新日志
    const changelog = project.changelog || [];
    const changelogHtml = changelog
        .map(cl => `
            <li class="md3-changelog-item">
                <div class="md3-changelog-item__header">v${cl.version} — ${cl.date}</div>
                <ul class="md3-changelog-item__list">
                    ${(cl.changes || []).map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                </ul>
            </li>
        `)
        .join('');

    body.innerHTML = `
        <h2 class="md3-detail-project-name">${escapeHtml(project.name || projectId)}</h2>
        <p class="md3-detail-project-desc">${escapeHtml(project.description || '')}</p>
        <div class="md3-detail-meta">
            ${platformBadges}
            ${tagBadges}
            <span class="md3-card__badge">v${project.version || '?'}</span>
            <span class="md3-card__badge">${project.author || 'Unknown'}</span>
        </div>

        <h3 class="md3-detail-section-title">📦 下载 (${files.length})</h3>
        <div class="md3-download-list">
            ${downloadList || '<p style="color:var(--md-sys-color-on-surface-variant);font:var(--md-sys-typescale-body-medium)">暂无可用文件</p>'}
        </div>

        ${changelog.length ? `
            <h3 class="md3-detail-section-title">📋 更新日志</h3>
            <ul class="md3-changelog">${changelogHtml}</ul>
        ` : ''}
    `;

    panel.classList.add('md3-detail-panel--open');
    document.body.style.overflow = 'hidden';

    // 监听下载事件
    $$('.md3-download-item a[download]', body).forEach(link => {
        link.addEventListener('click', () => {
            const name = link.closest('.md3-download-item')?.querySelector('.md3-download-item__name')?.textContent || '';
            showSnackbar(`开始下载：${name.trim()}`);
        });
    });
}

function closeDetail() {
    const panel = $('#detail-panel');
    panel.classList.remove('md3-detail-panel--open');
    document.body.style.overflow = '';
    STATE.detailProjectId = null;
}

// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
    // 主题切换
    $('#theme-toggle').addEventListener('click', toggleTheme);

    // 搜索
    const searchInput = $('#search-input');
    let searchDebounce;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            STATE.searchQuery = searchInput.value.trim();
            renderProjectCards();
        }, 300);
    });

    // 分类筛选
    $('#category-filters').addEventListener('click', (e) => {
        const chip = e.target.closest('.md3-filter-chip');
        if (!chip) return;

        STATE.activeCategory = chip.dataset.category;
        $$('.md3-filter-chip', $('#category-filters')).forEach(c => c.classList.remove('md3-filter-chip--selected'));
        chip.classList.add('md3-filter-chip--selected');
        renderProjectCards();
    });

    // 卡片点击 & 详情按钮
    $('#project-cards').addEventListener('click', (e) => {
        const detailBtn = e.target.closest('[data-action="detail"]');
        if (detailBtn) {
            e.stopPropagation();
            openDetail(detailBtn.dataset.project);
            return;
        }

        const card = e.target.closest('.md3-card');
        if (card && card.dataset.project) {
            openDetail(card.dataset.project);
        }
    });

    // 关闭详情
    $('#detail-close').addEventListener('click', closeDetail);
    $('#detail-overlay').addEventListener('click', closeDetail);

    // ESC 关闭详情
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && STATE.detailProjectId) {
            closeDetail();
        }
    });

    // Snackbar 关闭按钮
    const snackbarAction = $('.md3-snackbar__action');
    if (snackbarAction) {
        snackbarAction.addEventListener('click', () => {
            const bar = $('#snackbar');
            bar.classList.remove('md3-snackbar--visible');
        });
    }
}

// ============================================================
// 启动
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await initSite();
});
