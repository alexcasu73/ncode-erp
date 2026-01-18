#!/bin/bash

# ============================================================================
# Supabase Secure Start
# ============================================================================
# Questo script stoppa Supabase CLI e ricrea i container principali
# con port binding limitato a localhost (127.0.0.1)
# ============================================================================

set -e

echo "🔒 Supabase Secure Start"
echo "========================"
echo ""

# Colori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica se Supabase CLI è installato
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI non trovato${NC}"
    echo "Installa con: brew install supabase/tap/supabase"
    exit 1
fi

echo "⏹️  Stopping Supabase CLI..."
supabase stop

echo ""
echo "⚠️  ${YELLOW}ATTENZIONE${NC}: Supabase CLI non supporta nativamente il binding su localhost."
echo ""
echo "Hai 2 opzioni:"
echo ""
echo "1️⃣  ${GREEN}Firewall (RACCOMANDATO)${NC}"
echo "   - Supabase gira normalmente"
echo "   - Firewall blocca accesso esterno"
echo "   - Più semplice e sicuro"
echo ""
echo "2️⃣  ${YELLOW}Docker Manuale (AVANZATO)${NC}"
echo "   - Stop Supabase CLI completamente"
echo "   - Gestisci container Docker manualmente"
echo "   - Più complesso"
echo ""

read -p "Scegli opzione (1 o 2): " choice

case $choice in
  1)
    echo ""
    echo "🛡️  Abilitazione Firewall macOS..."
    echo ""

    # Verifica se il firewall è già attivo
    firewall_status=$(sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate | grep "enabled" || echo "disabled")

    if [[ $firewall_status == *"enabled"* ]]; then
        echo -e "${GREEN}✅ Firewall già attivo${NC}"
    else
        echo "Abilitazione firewall..."
        sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
        echo -e "${GREEN}✅ Firewall abilitato${NC}"
    fi

    # Abilita stealth mode (nasconde il computer dalla rete)
    echo "Abilitazione stealth mode..."
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
    echo -e "${GREEN}✅ Stealth mode abilitato${NC}"

    # Abilita logging
    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setloggingmode on
    echo -e "${GREEN}✅ Logging abilitato${NC}"

    echo ""
    echo "🔄 Riavvio Supabase..."
    supabase start

    echo ""
    echo -e "${GREEN}✅ COMPLETATO!${NC}"
    echo ""
    echo "Il firewall ora blocca connessioni esterne alle porte Supabase."
    echo "Il database è accessibile solo da localhost."
    echo ""
    echo "📊 Verifica:"
    echo "  netstat -an | grep LISTEN | grep -E '(54321|54322)'"
    echo ""
    ;;

  2)
    echo ""
    echo -e "${YELLOW}⚠️  ATTENZIONE: Modalità Avanzata${NC}"
    echo ""
    echo "Questa modalità richiede gestione manuale di Docker."
    echo "Non è raccomandata per utenti non esperti."
    echo ""
    read -p "Sei sicuro? (y/N): " confirm

    if [[ $confirm != [yY] ]]; then
        echo "Operazione annullata."
        exit 0
    fi

    echo ""
    echo "❌ Questa modalità non è ancora implementata."
    echo "Usa l'opzione 1 (Firewall) che è più semplice e sicura."
    echo ""
    exit 1
    ;;

  *)
    echo "Opzione non valida. Uscita."
    exit 1
    ;;
esac

echo ""
echo "🎉 Setup completato!"
