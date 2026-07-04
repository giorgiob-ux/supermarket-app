# Supermarket

A grocery shopping-list app that sorts items by supermarket aisle. Runs entirely in your browser — no account, no server, no internet connection required after the first load. All your lists stay on your device.

## Getting started

1. Host these files somewhere static — for example:
   - Drag the folder onto [Netlify Drop](https://app.netlify.com/drop)
   - Or push it to a GitHub repo and enable **GitHub Pages**
   - Or run it locally for testing: `npx serve .` (or `python3 -m http.server`) from this folder, then open the printed `http://localhost` address
2. Open that URL on your phone.
3. On iPhone: tap **Share → Add to Home Screen**. On Android: open the browser menu and tap **Install app** / **Add to Home Screen**.
4. Open it from your home screen like any other app — it works fully offline from then on.

> Opening `index.html` directly from your file system (double-clicking it) will *not* enable offline installation, because phone browsers require a real `http(s)` address for that. It's still fine for a quick look on desktop.

## Using it

- Tap **+** to create a list, then add items — the app recognises hundreds of common grocery items (in English or Italian) and sorts them by aisle automatically.
- Tap **⇅** to switch between aisle order, alphabetical, and recently-added.
- Tap **⭐** to quickly re-add items you buy often.
- Tap the **✏️** on any item to edit its quantity/note, or fix its name/category/icon in your personal catalogue.

## Making it match your own supermarket

This app ships with an example aisle layout (Carrefour Mirdif City Centre). Your store almost certainly looks different — go to **⚙️ Settings**:

- Tap a supermarket to open its aisle list. Reorder aisles with ▲▼, edit their label/icon/category, or add new ones.
- Items are grouped by matching their category to an aisle's category — categories with no matching aisle show under "General" until you add one.
- Add as many supermarkets as you like and pick one per list when you create it.

## Backing up your data

Everything is stored in this browser's local storage on this device only — clearing browsing data or switching phones will lose it. In **⚙️ Settings → Backup**:

- **Export data** downloads a `.json` file with everything (lists, items, supermarkets, aisles, your catalogue).
- **Import data** restores from that file (this replaces whatever is currently on the device).

## License

This is a paid product licensed for your own personal use on one device at a time — see [LICENSE.txt](LICENSE.txt). Reselling, redistributing, or sharing your copy isn't permitted.
