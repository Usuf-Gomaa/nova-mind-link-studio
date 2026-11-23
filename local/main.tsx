import {createRoot} from 'react-dom/client';
import Studio from '../app/studio';
import Login from './login';
import '../app/globals.css';
const hosted=import.meta.env.MODE==='hosted';
const path=location.pathname.replace(/\/$/,'');
const publicView=hosted?path!=='/admin':new URLSearchParams(location.search).get('view')==='public'||path.endsWith('/p');
createRoot(document.getElementById('root')!).render(hosted&&path==='/login'?<Login/>:<Studio publicView={publicView}/>);
