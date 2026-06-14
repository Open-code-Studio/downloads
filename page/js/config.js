/**
 * config.js — 站点配置加载器
 * 读取 page/config.json 并暴露为 window.SITE_CONFIG
 */
window.SITE_CONFIG = null;

(async () => {
    try {
        const res = await fetch('config.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        window.SITE_CONFIG = await res.json();
        console.log('[Config] 站点配置已加载', window.SITE_CONFIG);
    } catch (err) {
        console.error('[Config] 加载失败，使用默认配置', err);
        window.SITE_CONFIG = {
            site: {
                name: "OCS Downloads",
                description: "下载中心",
                language: "zh-CN",
                theme: { default: "dark", allowToggle: true },
                primaryColor: "#4AA26F"
            },
            projects: [],
            footer: { copyright: "", links: [] }
        };
    }
})();
