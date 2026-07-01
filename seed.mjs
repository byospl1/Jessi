// seed.mjs — carga la rutina de Jessi en Firestore
// Uso:  npm install firebase   &&   node seed.mjs
// Requiere reglas de Firestore en modo escritura temporal (ver README).

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

/* ====== CONFIG: pega la misma firebaseConfig que en index.html ====== */
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBU7g0qQFv3La_evrvASYgYFQI3t9wimSw",
  authDomain: "asesoriasjessi.firebaseapp.com",
  projectId: "asesoriasjessi",
  storageBucket: "asesoriasjessi.firebasestorage.app",
  messagingSenderId: "363108342077",
  appId: "1:363108342077:web:2d2bce050eccd3fd814d54"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
/* ==================================================================== */

const ALUMNA = "Jessi";

const dias = [
  { nombre:"Lunes", orden:1, ejercicios:[
    { nombre:"Estiramiento del piriforme sentado", sets:3, reps:"4", peso:"----" },
    { nombre:"Masaje en glúteo medio con pelotita", sets:3, reps:"2 min", peso:"----" },
    { nombre:"Máquina de abdomen", sets:2, reps:"12", peso:"nivel 18", descanso:"1:00" },
    { nombre:"Hip Thrust", sets:3, reps:"8", peso:"55 kg", descanso:"3:00", nota:"2 sets de 4 series con 54, 1 set fallo 45" },
    { nombre:"Patada de glúteo cruzada", sets:2, reps:"10", peso:"99", descanso:"1:30", nota:"Por pierna" },
    { nombre:"Búlgaras tronco inclinado (aprox. 30°)", sets:2, reps:"9", peso:"15 kg", descanso:"1:30", nota:"Por pierna" },
    { nombre:"Zancadas en movimiento", sets:3, reps:"32 pasos", peso:"20 kg", descanso:"3:00" },
    { nombre:"Extensiones individuales", sets:2, reps:"11", peso:"45", descanso:"1:30", nota:"Por pierna" },
    { nombre:"Aductores", sets:3, reps:"10", peso:"85 lb", descanso:"1:30" },
    { nombre:"Pantorrilla en prensa recta", sets:2, reps:"12", peso:"175", descanso:"1:30" },
  ]},
  { nombre:"Miércoles", orden:2, ejercicios:[
    { nombre:"Rotación externa de hombro", sets:3, reps:"12" },
    { nombre:"Posición T Y", sets:3, reps:"12" },
    { nombre:"Máquina de abdomen", sets:2, reps:"13", peso:"nivel 18" },
    { nombre:"Curl femoral sentada", sets:2, reps:"8", peso:"85" },
    { nombre:"Elevaciones laterales sentada", sets:3, reps:"10", peso:"8 kg" },
    { nombre:"Remos en máquina", sets:2, reps:"10", peso:"35 kg x lado", nota:"Inténtalas sin descanso" },
    { nombre:"Lat pull down", sets:2, reps:"8", peso:"88", nota:"88-1 tab. Corrígeme este peso." },
    { nombre:"Press inclinado", sets:2, reps:"7", peso:"15 kg", nota:"Coméntame sensaciones" },
    { nombre:"Predicador en banco", sets:2, reps:"12", peso:"20", nota:"Nos quedamos en el peso pero aumentamos set" },
    { nombre:"Extensiones de tríceps", sets:2, reps:"fallo", peso:"66" },
  ]},
  { nombre:"Viernes", orden:3, ejercicios:[
    { nombre:"Estiramiento supino del piriforme", sets:3, reps:"5", peso:"----" },
    { nombre:"Estiramiento de los flexores", sets:3, reps:"15", peso:"----" },
    { nombre:"Máquina de abdomen", sets:2, reps:"14", peso:"nivel 18" },
    { nombre:"Puentes de glúteo con barra", sets:3, reps:"12, 12, 10", peso:"35 kg", nota:"11, 11, set 9" },
    { nombre:"Peso muerto B-stand (pausa 2 s abajo)", sets:2, reps:"7", peso:"25 kg", nota:"6 ya están difíciles, no sé cómo veas quedarnos aquí. Mantenerme 2 s está difícil. Coméntame cómo se siente la espalda baja los siguientes días." },
    { nombre:"Abducción en máquina (glúteo)", sets:2, reps:"12", peso:"105" },
    { nombre:"Zancadas estáticas", sets:1, reps:"14", peso:"12.5 (mancuerna)", nota:'Vi que habías puesto "lado", ¿quieres que use 12.5 por lado?' },
    { nombre:"Prensa", sets:2, reps:"13, 10", peso:"60 kg" },
    { nombre:"Aductores", sets:2, reps:"14", peso:"70" },
    { nombre:"Pantorrilla en prensa recta", sets:2, reps:"fallo", peso:"130 lb" },
  ]},
  { nombre:"Sábado", orden:4, ejercicios:[
    { nombre:"Estiramiento del piriforme sentado", sets:3, reps:"4", peso:"----" },
    { nombre:"Masaje en glúteo medio con pelotita", sets:3, reps:"2 min", peso:"----" },
    { nombre:"Máquina de abdomen", sets:2, reps:"15", peso:"nivel 18" },
    { nombre:"Curl femoral sentada", sets:2, reps:"9", peso:"90" },
    { nombre:"Elevaciones laterales sentada", sets:2, reps:"9", peso:"8 kg", nota:"Ver nota (8)" },
    { nombre:"Press horizontal", sets:2, reps:"7, 5", peso:"70 lb", nota:"Funciona" },
    { nombre:"Pec deck", sets:2, reps:"10, 8", peso:"35 lb", nota:"Mejor" },
    { nombre:"Pull over", sets:1, reps:"11", peso:"77", nota:"Ver nota (10)" },
    { nombre:"Remo bajo", sets:1, reps:"11", peso:"32.5 kg", nota:"¿Podríamos cambiarlo a mancuerna? Una porque por más que acomode mi mano quedan como T-Rex, y dos porque al parecer estoy metiendo el trapecio." },
    { nombre:"Extensiones horizontales", sets:1, reps:"12", peso:"55 lb" },
    { nombre:"Curl de bíceps en máquina", sets:2, reps:"12", peso:"55 lb" },
  ]},
];

const db = getFirestore(initializeApp(firebaseConfig));

for (const d of dias) {
  const ref = await addDoc(collection(db,"rutinas"), {
    alumna: ALUMNA, nombre: d.nombre, orden: d.orden, archivada: false,
    ejercicios: d.ejercicios
  });
  console.log(`✓ ${d.nombre} (${d.ejercicios.length} ejercicios) -> ${ref.id}`);
}
console.log("Listo. Cambia las reglas de Firestore a solo lectura.");
process.exit(0);
