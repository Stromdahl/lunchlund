import { ScraperDescriptor } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

const URL = "https://brickseatery.se/";

export const bricks: ScraperDescriptor = {
  id: "bricks",
  name: "Bricks Eatery",
  address: "Mobilvägen 12, Lund",
  website: URL,
  scrape: () =>
    scrapeElementorLunch(URL, "Bricks Eatery", {
      hours: weekdayLunch("11:00", "13:30"),
    }),
};
