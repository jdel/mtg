# MTG card list

A static, searchable Magic: The Gathering card catalog built from ManaBox CSV exports and published with GitHub Pages.

## Make it your own

1. Fork this repository on GitHub.
2. In **Settings → Pages**, select **GitHub Actions** as the Pages source.
3. In the fork, replace the CSV files in `import/` with your ManaBox exports, commit and push the changes to `master`

The CSV exports are committed and therefore public. Do not include information you do not want visible in the repository.

Each CSV needs only these columns: `Name`, `Set code`, `Collector number`, `Foil`, `Quantity`, `Scryfall ID`, and `Language`. Other ManaBox columns are optional and ignored.

## Update the catalog

Add, replace, or remove CSV files in `import/`, commit the changes, and push to `master`. The deployment workflow rebuilds the catalog automatically.

## View the page

After the GitHub actions has finished running, the page will be available at https://<username>.github.io/mtg (or whatever name you decided for your fork)

## Local development

Local development requires Node.js 20.19 or newer on Node 20, or Node.js 22.12 or newer. After cloning the repository, run:

```sh
npm install
npm run import
npm run dev
```
