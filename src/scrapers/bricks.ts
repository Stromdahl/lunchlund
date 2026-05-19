import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

export function scrapeBricks(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://brickseatery.se/",
    name: "Bricks Eatery",
    address: "Mobilvägen 12, Lund",
    hours: weekdayLunch("11:00", "13:30"),
  });
}
