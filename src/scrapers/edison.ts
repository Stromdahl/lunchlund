import { ScraperDescriptor } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

const URL = "https://restaurangedison.se/lunch/";

export const edison: ScraperDescriptor = {
  id: "edison",
  name: "Restaurang Edison",
  address: "Emdalavägen 6B, Lund",
  website: URL,
  scrape: () =>
    scrapeElementorLunch(URL, "Restaurang Edison", {
      hours: weekdayLunch("11:15", "13:30"),
    }),
};
