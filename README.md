# Fiabilo Location Tree Scraper

This is a very small Chrome extension that:

- opens `https://fiabilo.tn/expediteur/pickup.php` when you click the extension icon
- waits for the `Gouvernorat -> Ville -> Localite` dropdown tree
- loops through every gouvernorat, then every ville inside it
- waits `2s` after each selection so the dependent dropdown can load
- downloads a JSON file with the full hierarchy

## Files

- `manifest.json`: Chrome extension manifest
- `background.js`: opens the target page or triggers the scraper again on the same page
- `content.js`: does the dropdown scraping and downloads the JSON

## How To Use

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `C:\Users\amara\OneDrive\Desktop\ext2`
5. Click the extension icon

If you are already logged in to Fiabilo, it should open the pickup page and start scraping automatically.

If Fiabilo sends you to a login page first, log in, then go back to the pickup page or click the extension icon again.

## Output Shape

The downloaded file looks like this:

```json
{
  "scrapedAt": "2026-04-05T17:35:00.000Z",
  "sourceUrl": "https://fiabilo.tn/expediteur/pickup.php",
  "gouvernorats": [
    {
      "label": "Ariana",
      "value": "1",
      "villes": [
        {
          "label": "Raoued",
          "value": "10",
          "localites": [
            {
              "label": "Borj Touil",
              "value": "100"
            }
          ]
        }
      ]
    }
  ]
}
```

## Notes

- The script uses the first three visible dropdowns as a fallback if label matching is not enough.
- The JSON contains both the visible text and the underlying option value.
- To run it again on the same page, click the extension icon again or refresh the page.
