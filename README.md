# MTG card list

A static, searchable Magic: The Gathering card catalog built from ManaBox CSV exports and published with GitHub Pages.

## Make it your own

1. Fork this repository on GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the Pages source. Make sure to select Enforce HTTPS.
3. In the fork, replace the CSV files in `trading/` with the cards you have and add the cards you want to `searching/`
4. Set your contact email in `public/config.json`
5. Commit and push the changes to `master`

The CSV exports are committed and therefore public. Do not include information you do not want visible in the repository.

Each CSV needs only these columns: `Name`, `Set code`, `Collector number`, `Foil`, `Quantity`, `Scryfall ID`, and `Language`. Other ManaBox columns are optional and ignored.

To merge the CSVs in `trading/` and `searching/` into a `Cards.csv` in each directory containing only the required columns, run:

```sh
npm run merge-csvs
```

## Update the catalog

Add, replace, or remove CSV files in `trading/` and `searching/`, commit the changes, and push to `master`. The deployment workflow rebuilds both catalogs automatically.

## View the page

After the GitHub actions has finished running, the page will be available at https://<username>.github.io/mtg (or whatever name you decided for your fork)

The Searching view is available directly at https://<username>.github.io/mtg/searching/

## Local development

Local development requires Node.js 20.19 or newer on Node 20, or Node.js 22.12 or newer. After cloning the repository, run:

```sh
npm install
npm run import
npm run dev
```
