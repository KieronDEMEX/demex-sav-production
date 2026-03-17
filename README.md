# Demex SAV - Déploiement Vercel

## 🚀 Déploiement en 3 étapes

### 1. Upload sur GitHub

Uploadez TOUS ces fichiers sur GitHub dans votre repo `demex-sav` :

```
demex-sav/
├── api/
│   └── odoo.js
├── index.html
├── package.json
├── .gitignore
└── README.md
```

### 2. Importer dans Vercel

1. Allez sur https://vercel.com
2. New Project → Importez `demex-sav`
3. **AVANT de déployer**, ajoutez les variables d'environnement :

| Variable | Valeur |
|----------|--------|
| `ODOO_URL` | `https://demexfr.odoo.com` |
| `ODOO_DB` | `demexfr` |
| `ODOO_USERNAME` | `kieron.vallet@demexfr.com` |
| `ODOO_PASSWORD` | `Demex26*` |

4. Cliquez **Deploy**

### 3. Testez

Allez sur `https://votre-app.vercel.app`

✅ Ça marche !

---

## 🔧 Structure des fichiers

- `api/odoo.js` - Fonction serverless Vercel (proxy Odoo)
- `index.html` - Frontend React
- `package.json` - Config minimale
- `.gitignore` - Fichiers à ignorer

---

**C'est tout !** Pas de configuration compliquée, juste ces fichiers + les 4 variables d'environnement.
