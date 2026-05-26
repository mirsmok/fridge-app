# Dom — Centralna aplikacja do zarządzania domem

## Środowisko

- **Urządzenie:** Raspberry Pi (`rpiPanel`, `192.168.10.185`)
- **System:** Debian Bookworm aarch64 (Raspberry Pi OS 64-bit)
- **Kernel:** Linux 6.6.51+rpt-rpi-v8
- **Użytkownik:** `mirsmok` / hasło: `mastodont`
- **Lokalizacja projektu na Pi:** `~/fridge-app/`
- **Lokalizacja kopii roboczej:** `/root/fridge-app/` (Android Termux PRoot)

## Dostęp

```
SSH:       ssh mirsmok@192.168.10.185
Aplikacja: http://192.168.10.185:5173
Backend:   http://192.168.10.185:3001
```

## Uruchamianie

Serwery działają w sesji `screen` o nazwie `fridge`:

```bash
ssh mirsmok@192.168.10.185
screen -r fridge          # podłącz do sesji
# Ctrl+A, 0 → backend (node server.js)
# Ctrl+A, 1 → frontend (vite)
# Ctrl+A, D → odłącz bez zatrzymywania
```

### Restart po rebootcie

```bash
ssh mirsmok@192.168.10.185
screen -S fridge -p 0 -X stuff 'cd ~/fridge-app/backend && node server.js\n'
screen -S fridge -X screen 1
screen -S fridge -p 1 -X stuff 'cd ~/fridge-app/frontend && npx vite\n'
```

## Stack technologiczny

| Warstwa | Technologia |
|---------|-------------|
| Backend | Node.js 20 + Express 4 |
| Baza danych | SQLite (`better-sqlite3`) |
| Frontend | React 18 + Vite 5 |
| Skaner kodów | `html5-qrcode` |
| Dane produktów | Open Food Facts API |
| Styl | Własny CSS (dark theme, mobile-first) |

## Struktura projektu

```
~/fridge-app/
├── backend/
│   ├── server.js       # Express API + inicjalizacja SQLite
│   ├── fridge.db       # Baza danych SQLite (auto-tworzona)
│   └── package.json
└── frontend/
    ├── index.html
    ├── vite.config.js  # host: 0.0.0.0, port: 5173, proxy /api → :3001
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx     # Nawigacja, routing między modułami
        ├── App.css     # Dark theme, zmienne CSS
        └── components/
            ├── Dashboard.jsx     # Alerty + skróty do modułów
            ├── Tasks.jsx         # Zadania jednorazowe
            ├── PeriodicTasks.jsx # Przeglądy cykliczne
            ├── ProductList.jsx   # Lista produktów w spiżarni
            ├── AddProduct.jsx    # Dodawanie przez skaner/ręcznie
            ├── Scanner.jsx       # Kamera + html5-qrcode
            ├── ShoppingList.jsx  # Lista zakupów
            ├── Meters.jsx        # Liczniki mediów
            ├── Appliances.jsx    # Urządzenia domowe
            ├── Documents.jsx     # Dokumenty z datami ważności
            └── Contacts.jsx      # Kontakty serwisowe
```

## Moduły aplikacji

### 🏠 Dashboard
- Alerty ze wszystkich modułów (czerwone = pilne, żółte = nadchodzące)
- Siatka skrótów do każdego modułu z licznikami
- Zaległe zadania, wygasające produkty/dokumenty, przeglądy

### ✅ Zadania
- Priorytety: Pilne / Wysoka / Normalna / Niska
- Terminy z alertami (dziś, zaległe, za X dni)
- Kategorie: dom, zakupy, auto, praca, rodzina, inne
- Filtry: Otwarte / Dziś / Zaległe / Ukończone

### 🔄 Przeglądy cykliczne
- Szablony startowe: przegląd auta, wymiana oleju, kocioł, filtry, rynny, OC, instalacja elektryczna
- Dowolny interwał w dniach (lub wybór z presetów: 1 mies./3/6 mies./1 rok/2 lata)
- Przycisk „Zrobione dzisiaj" → automatycznie oblicza następny termin
- Kolor karty: czerwony = zaległe, żółty = w ciągu 30 dni, zielony = OK

### 🧊 Spiżarnia (Lodówka)
- Dodawanie przez skaner kodów kreskowych (kamera telefonu)
- Auto-wypełnienie nazwy/kategorii/zdjęcia z Open Food Facts API
- Daty ważności z alertami kolorystycznymi (3/7 dni)
- Filtrowanie: wszystkie / wygasające / przeterminowane
- Lokalizacje: lodówka / zamrażarka / spiżarnia
- Przycisk „dodaj do listy zakupów"

### 🛒 Zakupy
- Lista zakupów z ręcznym dodawaniem i zaznaczaniem
- Auto-dodawanie z modułu Spiżarni
- Czyszczenie kupionych pozycji jednym kliknięciem

### 📊 Liczniki mediów
- Prąd (kWh), Gaz (m³), Woda zimna/ciepła (m³), Ciepło (GJ)
- Historia odczytów z datami
- Obliczane zużycie między odczytami
- Mini wykres słupkowy (SVG) zużycia

### 🔧 Urządzenia
- Sprzęt AGD/RTV, ogrzewanie, klimatyzacja, narzędzia, auto
- Śledzenie: data zakupu, długość gwarancji, koniec gwarancji (auto)
- Śledzenie serwisu: ostatni serwis, interwał, następny termin (auto)
- Alert 30 dni przed końcem gwarancji / terminem serwisu

### 📄 Dokumenty
- Kategorie: ubezpieczenie 🛡️, pojazd 🚗, tożsamość 🪪, nieruchomość 🏠, zdrowie 🏥, praca 💼
- Daty wydania i ważności
- Konfigurowalne przypomnienie (7/14/30/60/90 dni przed wygaśnięciem)
- Filtry: wszystkie / wygasające (30d) / wygasłe
- Pole na notatki (nr polisy, nr dokumentu)

### 📞 Kontakty
- Hydraulik, elektryk, gazownik, malarz, lekarz, pogotowie, policja, straż itp.
- Klik na numer → bezpośrednie połączenie (`tel:`)
- Ulubione wyświetlane na górze listy
- Wyszukiwarka po nazwie, roli i numerze

## Baza danych — tabele SQLite

| Tabela | Opis |
|--------|------|
| `products` | Produkty w spiżarni |
| `shopping_list` | Lista zakupów |
| `tasks` | Zadania jednorazowe |
| `periodic_tasks` | Przeglądy cykliczne |
| `meters` | Definicje liczników |
| `meter_readings` | Odczyty liczników |
| `appliances` | Urządzenia domowe |
| `documents` | Dokumenty z datami ważności |
| `contacts` | Kontakty serwisowe |

## API Backend — endpointy

```
GET/POST   /api/products
PUT/DELETE /api/products/:id
GET        /api/barcode/:code          ← Open Food Facts

GET/POST   /api/shopping
PUT/DELETE /api/shopping/:id
DELETE     /api/shopping               ← usuń zaznaczone

GET/POST   /api/tasks
PUT/DELETE /api/tasks/:id

GET/POST   /api/periodic
PUT/DELETE /api/periodic/:id
POST       /api/periodic/:id/done      ← oznacz jako wykonane dziś

GET/POST   /api/meters
DELETE     /api/meters/:id
POST       /api/meters/:id/readings
DELETE     /api/meters/readings/:id

GET/POST   /api/appliances
PUT/DELETE /api/appliances/:id

GET/POST   /api/documents
PUT/DELETE /api/documents/:id

GET/POST   /api/contacts
PUT/DELETE /api/contacts/:id

GET        /api/alerts                 ← wszystkie alerty z wszystkich modułów
```

## Logika alertów (`/api/alerts`)

| Źródło | Poziom danger | Poziom warn |
|--------|--------------|-------------|
| Zadania | zaległe (po terminie) | na dziś |
| Przeglądy | zaległe | w ciągu 7 dni |
| Produkty | przeterminowane | wygasają w 7 dni |
| Dokumenty | wygasłe | wygasają w 30 dni |
| Gwarancje | wygasłe | kończą się w 30 dni |
| Serwis urządzeń | zaległy | w ciągu 30 dni |

## Nawigacja

**Bottom nav (główna):** 🏠 Dom · ✅ Zadania · 🧊 Spiżarnia · 🔄 Przeglądy · ☰ Więcej

**Więcej (slide-up menu):** 🛒 Zakupy · ＋ Dodaj produkt · 📊 Liczniki · 🔧 Urządzenia · 📄 Dokumenty · 📞 Kontakty

## Ważne uwagi techniczne

- **Filesystem:** kod projektu musi być w `/root/fridge-app/` (nie na sdcard) — Android sdcard (FAT) nie obsługuje symlinków wymaganych przez npm
- **Vite host:** `0.0.0.0` (nie `true`) — PRoot na Androidzie nie obsługuje `uv_interface_addresses`
- **screen:** serwery uruchomione w `screen -S fridge` (okno 0: backend, okno 1: frontend) — zabezpieczenie przed utratą połączenia SSH
- **Node.js:** zainstalowany przez NodeSource (v20 LTS), nie z apt Debian (zbyt stara wersja)
- **better-sqlite3:** kompiluje natywny moduł C++ — działa na Pi ARM64, nie kompiluje się na sdcard FAT

## Wdrożenie zmian z Androida na Pi

```bash
# edytuj pliki w /root/fridge-app/
sshpass -p 'mastodont' scp plik mirsmok@192.168.10.185:~/fridge-app/ścieżka/
# backend: restart node
# frontend: Vite przeładuje automatycznie (HMR)
```
