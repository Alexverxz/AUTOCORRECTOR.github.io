document.addEventListener("DOMContentLoaded", () => {
    
    // --- CLASE TRIE (Árbol de Prefijos para autocompletado de tecleo) ---
    class TrieNode {
        constructor() {
            this.children = {};
            this.isEndOfWord = false;
            this.palabraOriginal = "";
        }
    }

    class Trie {
        constructor() {
            this.root = new TrieNode();
        }

        normalizar(str) {
            return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        }

        insert(palabra) {
            let node = this.root;
            const palabraLimpia = this.normalizar(palabra);

            for (let char of palabraLimpia) {
                if (!node.children[char]) {
                    node.children[char] = new TrieNode();
                }
                node = node.children[char];
            }
            node.isEndOfWord = true;
            node.palabraOriginal = palabra;
        }

        _buscarNodo(prefijo) {
            let node = this.root;
            const prefijoLimpio = this.normalizar(prefijo);
            for (let char of prefijoLimpio) {
                if (!node.children[char]) {
                    return null;
                }
                node = node.children[char];
            }
            return node;
        }

        _recolectarPalabras(node, lista) {
            if (!node) return;
            if (node.isEndOfWord) {
                lista.push(node.palabraOriginal);
            }
            for (let char in node.children) {
                this._recolectarPalabras(node.children[char], lista);
            }
        }

        obtenerSugerencias(prefijo) {
            const nodoPrefijo = this._buscarNodo(prefijo);
            const resultados = [];
            if (!nodoPrefijo) return resultados;
            
            this._recolectarPalabras(nodoPrefijo, resultados);
            return resultados;
        }
    }

    const triePalabras = new Trie();
    let reglasContextualesGlobales = []; // Almacenará las reglas semánticas del JSON

    // Captura de elementos del DOM
    const inputOracion = document.getElementById("inputOracion");
    const contadorChars = document.getElementById("contadorChars");
    const listaSugerencias = document.getElementById("listaSugerencias");
    const estadoPredictivo = document.getElementById("estadoPredictivo");
    const resultadoBox = document.getElementById("resultadoBox");
    const btnRevisar = document.getElementById("btnRevisar");

    // Función auxiliar de normalización general
    const normalizarTexto = (str) => {
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    };

    // --- CARGAR EL JSON E INICIALIZAR ESTRUCTURAS ---
    fetch("biblioteca.json")
        .then(response => {
            if (!response.ok) throw new Error("No se pudo cargar el archivo JSON de la biblioteca.");
            return response.json();
        })
        .then(data => {
            // 1. Indexar palabras en el Trie
            const palabras = data.palabrasLógicas || [];
            palabras.forEach(palabra => {
                if (palabra.trim().length > 0) {
                    triePalabras.insert(palabra);
                }
            });

            // 2. Cargar reglas contextuales para análisis semántico de oraciones
            reglasContextualesGlobales = data.reglasContextuales || [];

            estadoPredictivo.textContent = "Sistema lógico listo";
            estadoPredictivo.className = "badge bg-secondary";
        })
        .catch(error => {
            console.error("Error:", error);
            estadoPredictivo.textContent = "Error al cargar JSON";
            estadoPredictivo.className = "badge bg-danger";
        });

    // --- EVENTO DE ESCRITURA EN TIEMPO REAL ---
    inputOracion.addEventListener("input", (e) => {
        const textoCompleto = e.target.value;
        
        contadorChars.textContent = `${textoCompleto.length} / 50 caracteres`;
        listaSugerencias.innerHTML = "";
        resultadoBox.innerHTML = "";

        if (textoCompleto.length === 0) {
            estadoPredictivo.textContent = "Escribe para predecir";
            estadoPredictivo.className = "badge bg-secondary";
            return;
        }

        const palabrasArray = textoCompleto.trim().split(" ");
        const ultimaPalabra = palabrasArray[palabrasArray.length - 1];
        const textoLimpio = normalizarTexto(textoCompleto);

        let sugerenciasMostradas = [];

        // CASO A: ANÁLISIS DE CONTEXTO SEMÁNTICO (Detecta palabras clave de la oración)
        // Revisa si alguna palabra de la oración coincide con nuestra base de reglas (Ej: "perro" -> "animal")
        const coincidenciasContextuales = reglasContextualesGlobales.filter(regla => {
            return textoLimpio.includes(normalizarTexto(regla.clave));
        });

        if (coincidenciasContextuales.length > 0) {
            coincidenciasContextuales.forEach(item => {
                if (!sugerenciasMostradas.includes(item.sugerencia)) {
                    sugerenciasMostradas.push(item.sugerencia);
                }
            });
        }

        // CASO B: AUTOCOMPLETADO POR TRIE (Si el usuario está tecleando una palabra de 3+ letras)
        if (ultimaPalabra.length >= 3) {
            const coincidenciasTrie = triePalabras.obtenerSugerencias(ultimaPalabra);
            coincidenciasTrie.forEach(palabra => {
                if (!sugerenciasMostradas.includes(palabra)) {
                    sugerenciasMostradas.push(palabra);
                }
            });
        }

        // RENDERIZAR SUGERENCIAS EN LA INTERFAZ
        if (sugerenciasMostradas.length > 0) {
            estadoPredictivo.textContent = `${sugerenciasMostradas.length} sugerencias lógicas`;
            estadoPredictivo.className = "badge bg-success";

            sugerenciasMostradas.slice(0, 6).forEach(sugerencia => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "list-group-item list-group-item-action small py-2";
                btn.innerHTML = `Completar con lógica: <strong>${sugerencia}</strong>`;

                // Acción al hacer clic: reemplaza la última palabra o añade al final de la oración incompleta
                btn.addEventListener("click", () => {
                    // Si el usuario dejó la última palabra incompleta o quiere aplicar la sugerencia lógica
                    if (ultimaPalabra.length >= 3 && sugerenciasMostradas.includes(ultimaPalabra)) {
                        palabrasArray[palabrasArray.length - 1] = sugerencia;
                    } else {
                        // Si era una oración incompleta tipo "El perro es un", añade la palabra lógica limpia
                        palabrasArray.push(sugerencia);
                    }
                    
                    inputOracion.value = palabrasArray.join(" ") + " ";
                    contadorChars.textContent = `${inputOracion.value.length} / 50 caracteres`;
                    listaSugerencias.innerHTML = "";
                    estadoPredictivo.textContent = "Sugerencia aplicada";
                    estadoPredictivo.className = "badge bg-primary";
                    inputOracion.focus();
                });

                listaSugerencias.appendChild(btn);
            });
        } else {
            if (ultimaPalabra.length >= 3) {
                estadoPredictivo.textContent = "Sin coincidencias";
                estadoPredictivo.className = "badge bg-warning text-dark";
            } else {
                estadoPredictivo.textContent = "Escribe 3 letras o analiza contexto";
                estadoPredictivo.className = "badge bg-info text-dark";
            }
        }
    });

    // Botón de revisión final
    btnRevisar.addEventListener("click", () => {
        const textoFinal = inputOracion.value.trim();
        listaSugerencias.innerHTML = "";

        if (!textoFinal) {
            resultadoBox.innerHTML = `<div class="alert alert-warning small py-2">Por favor escribe una oración en el cuadro de texto.</div>`;
            return;
        }

        resultadoBox.innerHTML = `
            <div class="alert alert-success small py-2">
                <strong>Oración lógica procesada con éxito:</strong><br>
                "${textoFinal}"
            </div>
        `;
    });
});