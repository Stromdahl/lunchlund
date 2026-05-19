import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";

export function scrapeBricks(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://brickseatery.se/",
    name: "Bricks Eatery",
    address: "Mobilvägen 12, Lund",
  });
}
