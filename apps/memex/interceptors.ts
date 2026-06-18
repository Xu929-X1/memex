import { CLIENT_HEADER, CLIENTS } from "@memex/shared";
import axios, { InternalAxiosRequestConfig } from "axios";

axios.interceptors.request.use(async (config: InternalAxiosRequestConfig<any>)=>{
    config.headers.set(CLIENT_HEADER, CLIENTS.web);
    return config;
},
async (error)=>{
    return Promise.reject(error);
})