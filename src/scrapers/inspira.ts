import { ScraperDescriptor } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

const URL = "https://restauranginspira.se/";

export const inspira: ScraperDescriptor = {
  id: "inspira",
  name: "Restaurang & Café Inspira",
  address: "Scheelevägen 4, Lund",
  website: URL,
  scrape: () =>
    scrapeElementorLunch(URL, "Restaurang & Café Inspira", {
      hours: weekdayLunch("11:30", "13:30"),
    }),
};
