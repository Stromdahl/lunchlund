import { Restaurant } from "../types";
import { scrapeElementorLunch } from "./elementor-lunch";
import { weekdayLunch } from "../hours";

export function scrapeEdison(): Promise<Restaurant> {
  return scrapeElementorLunch({
    url: "https://restaurangedison.se/lunch/",
    name: "Restaurang Edison",
    address: "Emdalavägen 6B, Lund",
    hours: weekdayLunch("11:15", "13:30"),
  });
}
