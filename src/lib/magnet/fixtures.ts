export type LegalFixture = {
  id: string;
  title: string;
  blurb: string;
  license: string;
  magnet: string;
  torrentUrl?: string;
  sizeLabel: string;
  kind: "small" | "multi" | "large";
  defaultSelectNames?: string[];
};

export const PROBE_INFO_HASH = "f4beee6ffe97185e2753fc987ade8cb8a066f46c";
export const SINTEL_INFO_HASH = "08ada5a7a6183aae1e09d831df6748d566095a10";

export const LEGAL_FIXTURES: LegalFixture[] = [
  {
    id: "probe",
    title: "MagnetBridge 探针",
    blurb: "本工具自带的 CC0 小文件，用来验证完整闭环。",
    license: "CC0-1.0",
    magnet: `magnet:?xt=urn:btih:${PROBE_INFO_HASH}&dn=magnetbridge-probe.txt&ws=/fixtures/magnetbridge-probe.txt&xs=/fixtures/magnetbridge-probe.torrent`,
    torrentUrl: "/fixtures/magnetbridge-probe.torrent",
    sizeLabel: "48 KB",
    kind: "small",
  },
  {
    id: "sintel-srt",
    title: "Sintel 英文字幕",
    blurb: "Blender 开源电影 Sintel 的英文 SRT，多文件种子中的小文件。",
    license: "CC-BY-3.0",
    magnet:
      "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent",
    torrentUrl: "https://webtorrent.io/torrents/sintel.torrent",
    sizeLabel: "1.5 KB（所属多文件包 123 MB）",
    kind: "multi",
    defaultSelectNames: ["Sintel.en.srt"],
  },
  {
    id: "sintel",
    title: "Sintel 全包",
    blurb: "Blender Foundation 的 CC-BY 电影，含 mp4、字幕与海报。",
    license: "CC-BY-3.0",
    magnet:
      "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&ws=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2F&xs=https%3A%2F%2Fwebtorrent.io%2Ftorrents%2Fsintel.torrent",
    torrentUrl: "https://webtorrent.io/torrents/sintel.torrent",
    sizeLabel: "123 MB",
    kind: "large",
  },
];

export const KNOWN_TORRENT_URLS: Record<string, string> = {
  [PROBE_INFO_HASH]: "/fixtures/magnetbridge-probe.torrent",
  [SINTEL_INFO_HASH]: "https://webtorrent.io/torrents/sintel.torrent",
};
