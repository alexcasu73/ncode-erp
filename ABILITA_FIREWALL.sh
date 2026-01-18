#!/bin/bash

echo "🛡️ Abilitazione Firewall macOS"
echo "=============================="
echo ""
echo "Questo script abiliterà il firewall per proteggere le porte Supabase."
echo "Ti verrà chiesta la password di sistema."
echo ""
read -p "Premi INVIO per continuare..."

echo ""
echo "1️⃣ Abilitazione firewall..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on

echo ""
echo "2️⃣ Abilitazione stealth mode (nasconde il computer dalla rete)..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on

echo ""
echo "3️⃣ Abilitazione logging..."
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setloggingmode on

echo ""
echo "📊 Verifica stato firewall:"
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

echo ""
echo "✅ FIREWALL ABILITATO CON SUCCESSO!"
echo ""
echo "Il database Supabase continua a funzionare normalmente."
echo "Solo l'accesso da altri computer è bloccato."
echo ""
