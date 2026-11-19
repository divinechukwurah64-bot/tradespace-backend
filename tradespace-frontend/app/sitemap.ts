import type { MetadataRoute } from "next";

const baseUrl = "https://www.tradespace.online";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: baseUrl,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/auctions`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/clear-space`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/live`,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}