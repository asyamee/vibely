import axios from "axios";

export const initAxiosInstance = (access_token: string) => {
  const instance = axios.create({
    baseURL: "https://api.music.yandex.net",
    headers: {
      Authorization: `OAuth ${access_token}`,
    },
  });

  return instance;
};
