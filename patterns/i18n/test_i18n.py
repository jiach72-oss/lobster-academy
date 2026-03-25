"""Tests for I18n redaction patterns.

Each country/region has at least 2 test cases covering different ID types.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'python-sdk', 'src'))

from lobster_academy.redactor import Redactor
from detector import I18nDetector

import pytest


@pytest.fixture
def redactor():
    return Redactor()


@pytest.fixture
def detector():
    return I18nDetector()


class TestJapan:
    def test_my_number(self, redactor):
        text = "マイナンバー: 1234 5678 9012"
        result = redactor.redact_with_locale(text, "JP")
        assert "1234 5678 9012" not in result
        assert "[REDACTED_JP_MYNUMBER]" in result

    def test_phone(self, redactor):
        text = "電話: 090-1234-5678"
        result = redactor.redact_with_locale(text, "JP")
        assert "090-1234-5678" not in result


class TestSouthKorea:
    def test_rrn(self, redactor):
        text = "주민등록번호: 901234-1234567"
        result = redactor.redact_with_locale(text, "KR")
        assert "901234-1234567" not in result
        assert "[REDACTED_KR_RRN]" in result

    def test_phone(self, redactor):
        text = "연락처: 010-1234-5678"
        result = redactor.redact_with_locale(text, "KR")
        assert "010-1234-5678" not in result
        assert "[REDACTED_KR_PHONE]" in result


class TestIndia:
    def test_aadhaar(self, redactor):
        text = "Aadhaar: 1234 5678 9012"
        result = redactor.redact_with_locale(text, "IN")
        assert "1234 5678 9012" not in result
        assert "[REDACTED_IN_AADHAAR]" in result

    def test_pan(self, redactor):
        text = "PAN: ABCDE1234F"
        result = redactor.redact_with_locale(text, "IN")
        assert "ABCDE1234F" not in result
        assert "[REDACTED_IN_PAN]" in result

    def test_phone(self, redactor):
        text = "Mobile: +91 9876543210"
        result = redactor.redact_with_locale(text, "IN")
        assert "9876543210" not in result
        assert "[REDACTED_IN_PHONE]" in result


class TestThailand:
    def test_national_id(self, redactor):
        text = "ID: 1-2345-67890-12-3"
        result = redactor.redact_with_locale(text, "TH")
        assert "1-2345-67890-12-3" not in result
        assert "[REDACTED_TH_ID]" in result

    def test_phone(self, redactor):
        text = "Tel: 081 234 5678"
        result = redactor.redact_with_locale(text, "TH")
        assert "081 234 5678" not in result
        assert "[REDACTED_TH_PHONE]" in result


class TestSingapore:
    def test_nric(self, redactor):
        text = "NRIC: S1234567A"
        result = redactor.redact_with_locale(text, "SG")
        assert "S1234567A" not in result
        assert "[REDACTED_SG_NRIC]" in result

    def test_fin(self, redactor):
        text = "FIN: G7654321B"
        result = redactor.redact_with_locale(text, "SG")
        assert "G7654321B" not in result
        assert "[REDACTED_SG_NRIC]" in result

    def test_phone(self, redactor):
        text = "Phone: 91234567"
        result = redactor.redact_with_locale(text, "SG")
        assert "91234567" not in result


class TestIndonesia:
    def test_nik(self, redactor):
        text = "NIK: 3201010101000001"
        result = redactor.redact_with_locale(text, "ID")
        assert "3201010101000001" not in result
        assert "[REDACTED_ID_NIK]" in result

    def test_npwp(self, redactor):
        text = "NPWP: 01.234.567.8-901.000"
        result = redactor.redact_with_locale(text, "ID")
        assert "01.234.567.8-901.000" not in result
        assert "[REDACTED_ID_NPWP]" in result


class TestVietnam:
    def test_cccd(self, redactor):
        text = "CCCD: 001234567890"
        result = redactor.redact_with_locale(text, "VN")
        assert "001234567890" not in result
        assert "[REDACTED_VN_CCCD]" in result

    def test_phone(self, redactor):
        text = "SĐT: 0912345678"
        result = redactor.redact_with_locale(text, "VN")
        assert "0912345678" not in result
        assert "[REDACTED_VN_PHONE]" in result


class TestUnitedKingdom:
    def test_nhs(self, redactor):
        text = "NHS: 123 456 7890"
        result = redactor.redact_with_locale(text, "GB")
        assert "123 456 7890" not in result
        assert "[REDACTED_GB_NHS]" in result

    def test_ni_number(self, redactor):
        text = "NI: AB 12 34 56 C"
        result = redactor.redact_with_locale(text, "GB")
        assert "AB 12 34 56 C" not in result
        assert "[REDACTED_GB_NI]" in result


class TestGermany:
    def test_tax_id(self, redactor):
        text = "Steuer-ID: 12345678901"
        result = redactor.redact_with_locale(text, "DE")
        assert "12345678901" not in result
        assert "[REDACTED_DE_TAX]" in result

    def test_vat(self, redactor):
        text = "USt-IdNr.: DE123456789"
        result = redactor.redact_with_locale(text, "DE")
        assert "DE123456789" not in result
        assert "[REDACTED_DE_VAT]" in result

    def test_social_security(self, redactor):
        text = "SVNr: 12 040190 A 123"
        result = redactor.redact_with_locale(text, "DE")
        assert "12 040190 A 123" not in result
        assert "[REDACTED_DE_SSN]" in result


class TestFrance:
    def test_insee(self, redactor):
        text = "NIR: 1 85 05 75 056 045 25"
        result = redactor.redact_with_locale(text, "FR")
        assert "056 045 25" not in result
        assert "[REDACTED_FR_INSEE]" in result

    def test_siret(self, redactor):
        text = "SIRET: 123 456 789 00012"
        result = redactor.redact_with_locale(text, "FR")
        assert "123 456 789 00012" not in result
        assert "[REDACTED_FR_SIRET]" in result


class TestItaly:
    def test_codice_fiscale(self, redactor):
        text = "CF: RSSMRA85M01H501Z"
        result = redactor.redact_with_locale(text, "IT")
        assert "RSSMRA85M01H501Z" not in result
        assert "[REDACTED_IT_CF]" in result

    def test_partita_iva(self, redactor):
        text = "P.IVA: IT12345678901"
        result = redactor.redact_with_locale(text, "IT")
        assert "IT12345678901" not in result
        assert "[REDACTED_IT_IVA]" in result

    def test_phone(self, redactor):
        text = "Tel: 06 12345678"
        result = redactor.redact_with_locale(text, "IT")
        assert "06 12345678" not in result
        assert "[REDACTED_IT_PHONE]" in result


class TestSpain:
    def test_dni(self, redactor):
        text = "DNI: 12345678A"
        result = redactor.redact_with_locale(text, "ES")
        assert "12345678A" not in result
        assert "[REDACTED_ES_DNI]" in result

    def test_nie(self, redactor):
        text = "NIE: X1234567L"
        result = redactor.redact_with_locale(text, "ES")
        assert "X1234567L" not in result
        assert "[REDACTED_ES_NIE]" in result


class TestNetherlands:
    def test_bsn(self, redactor):
        text = "BSN: 123456789"
        result = redactor.redact_with_locale(text, "NL")
        assert "123456789" not in result
        assert "[REDACTED_NL_BSN]" in result

    def test_phone(self, redactor):
        text = "Tel: 06-12345678"
        result = redactor.redact_with_locale(text, "NL")
        assert "12345678" not in result


class TestPoland:
    def test_pesel(self, redactor):
        text = "PESEL: 90010112345"
        result = redactor.redact_with_locale(text, "PL")
        assert "90010112345" not in result
        assert "[REDACTED_PL_PESEL]" in result

    def test_nip(self, redactor):
        text = "NIP: 123-456-78-90"
        result = redactor.redact_with_locale(text, "PL")
        assert "123-456-78-90" not in result
        assert "[REDACTED_PL_NIP]" in result


class TestUnitedStates:
    def test_ssn(self, redactor):
        text = "SSN: 123-45-6789"
        result = redactor.redact_with_locale(text, "US")
        assert "123-45-6789" not in result
        assert "[REDACTED_US_SSN]" in result

    def test_itin(self, redactor):
        text = "ITIN: 900-70-0000"
        result = redactor.redact_with_locale(text, "US")
        assert "900-70-0000" not in result
        assert "[REDACTED_US_ITIN]" in result

    def test_ein(self, redactor):
        text = "EIN: 12-3456789"
        result = redactor.redact_with_locale(text, "US")
        assert "12-3456789" not in result
        assert "[REDACTED_US_EIN]" in result


class TestCanada:
    def test_sin(self, redactor):
        text = "SIN: 123-456-789"
        result = redactor.redact_with_locale(text, "CA")
        assert "123-456-789" not in result
        assert "[REDACTED_CA_SIN]" in result

    def test_health_card(self, redactor):
        text = "Health Card: 1234-567-890-AB"
        result = redactor.redact_with_locale(text, "CA")
        assert "1234-567-890-AB" not in result
        assert "[REDACTED_CA_HEALTH]" in result


class TestBrazil:
    def test_cpf(self, redactor):
        text = "CPF: 123.456.789-09"
        result = redactor.redact_with_locale(text, "BR")
        assert "123.456.789-09" not in result
        assert "[REDACTED_BR_CPF]" in result

    def test_cnpj(self, redactor):
        text = "CNPJ: 12.345.678/0001-90"
        result = redactor.redact_with_locale(text, "BR")
        assert "12.345.678/0001-90" not in result
        assert "[REDACTED_BR_CNPJ]" in result

    def test_phone(self, redactor):
        text = "Telefone: (11) 98765-4321"
        result = redactor.redact_with_locale(text, "BR")
        assert "98765-4321" not in result


class TestMexico:
    def test_curp(self, redactor):
        text = "CURP: GARC850101HDFRNN09"
        result = redactor.redact_with_locale(text, "MX")
        assert "GARC850101HDFRNN09" not in result
        assert "[REDACTED_MX_CURP]" in result

    def test_rfc(self, redactor):
        text = "RFC: GARC850101AB1"
        result = redactor.redact_with_locale(text, "MX")
        assert "GARC850101AB1" not in result
        assert "[REDACTED_MX_RFC]" in result


class TestArgentina:
    def test_dni(self, redactor):
        text = "DNI: 12.345.678"
        result = redactor.redact_with_locale(text, "AR")
        assert "12.345.678" not in result
        assert "[REDACTED_AR_DNI]" in result

    def test_cuit(self, redactor):
        text = "CUIT: 20-12345678-3"
        result = redactor.redact_with_locale(text, "AR")
        assert "20-12345678-3" not in result
        assert "[REDACTED_AR_CUIT]" in result


class TestSouthAfrica:
    def test_id_number(self, redactor):
        text = "ID: 8001015009087"
        result = redactor.redact_with_locale(text, "ZA")
        assert "8001015009087" not in result
        assert "[REDACTED_ZA_ID]" in result

    def test_phone(self, redactor):
        text = "Cell: 0821234567"
        result = redactor.redact_with_locale(text, "ZA")
        assert "0821234567" not in result
        assert "[REDACTED_ZA_PHONE]" in result


class TestUAE:
    def test_emirates_id(self, redactor):
        text = "Emirates ID: 784-1985-1234567-1"
        result = redactor.redact_with_locale(text, "AE")
        assert "784-1985-1234567-1" not in result
        assert "[REDACTED_AE_EID]" in result

    def test_phone(self, redactor):
        text = "Mobile: 050-1234567"
        result = redactor.redact_with_locale(text, "AE")
        assert "1234567" not in result


class TestSaudiArabia:
    def test_iqama(self, redactor):
        text = "Iqama: 2345678901"
        result = redactor.redact_with_locale(text, "SA")
        assert "2345678901" not in result
        assert "[REDACTED_SA_IQAMA]" in result

    def test_phone(self, redactor):
        text = "Mobile: 0512345678"
        result = redactor.redact_with_locale(text, "SA")
        assert "0512345678" not in result
        assert "[REDACTED_SA_PHONE]" in result


class TestAustralia:
    def test_tfn(self, redactor):
        text = "TFN: 123 456 789"
        result = redactor.redact_with_locale(text, "AU")
        assert "123 456 789" not in result
        assert "[REDACTED_AU_TFN]" in result

    def test_medicare(self, redactor):
        text = "Medicare: 1234-56789-0-1"
        result = redactor.redact_with_locale(text, "AU")
        assert "1234-56789-0-1" not in result
        assert "[REDACTED_AU_MEDICARE]" in result

    def test_abn(self, redactor):
        text = "ABN: 12 345 678 901"
        result = redactor.redact_with_locale(text, "AU")
        assert "12 345 678 901" not in result
        assert "[REDACTED_AU_ABN]" in result


class TestNewZealand:
    def test_ird(self, redactor):
        text = "IRD: 123-456-789"
        result = redactor.redact_with_locale(text, "NZ")
        assert "123-456-789" not in result
        assert "[REDACTED_NZ_IRD]" in result

    def test_nhi(self, redactor):
        text = "NHI: ABC1234"
        result = redactor.redact_with_locale(text, "NZ")
        assert "ABC1234" not in result
        assert "[REDACTED_NZ_NHI]" in result


class TestAutoDetect:
    def test_detect_brazilian_cpf(self, redactor):
        text = "Cliente CPF: 123.456.789-09"
        result = redactor.auto_detect_and_redact(text)
        assert "[REDACTED_BR_CPF]" in result["text"]
        assert result["detected_locale"] == "BR"

    def test_detect_italian_cf(self, redactor):
        text = "Codice Fiscale: RSSMRA85M01H501Z"
        result = redactor.auto_detect_and_redact(text)
        assert "[REDACTED_IT_CF]" in result["text"]
        assert result["detected_locale"] == "IT"

    def test_detect_german_vat(self, redactor):
        text = "USt-IdNr.: DE123456789"
        result = redactor.auto_detect_and_redact(text)
        assert "[REDACTED_DE_VAT]" in result["text"]
        assert result["detected_locale"] == "DE"

    def test_detect_mexican_curp(self, redactor):
        text = "CURP: GARC850101HDFRNN09"
        result = redactor.auto_detect_and_redact(text)
        assert "[REDACTED_MX_CURP]" in result["text"]
        assert result["detected_locale"] == "MX"

    def test_detect_singapore_nric(self, redactor):
        text = "NRIC: S1234567A"
        result = redactor.auto_detect_and_redact(text)
        assert "[REDACTED_SG_NRIC]" in result["text"]
        assert result["detected_locale"] == "SG"

    def test_no_detection(self, redactor):
        text = "Hello, this is just a normal sentence."
        result = redactor.auto_detect_and_redact(text)
        assert result["detected_locale"] is None

    def test_empty_text(self, redactor):
        result = redactor.auto_detect_and_redact("")
        assert result["text"] == ""
        assert result["detected_locale"] is None


class TestDetector:
    def test_supported_locales(self, detector):
        locales = detector.get_supported_locales()
        assert len(locales) == 24
        codes = [l["code"] for l in locales]
        assert "JP" in codes
        assert "BR" in codes
        assert "DE" in codes
        assert "AU" in codes

    def test_patterns_for_locale(self, detector):
        patterns = detector.get_patterns_for_locale("US")
        assert len(patterns) >= 3  # SSN, ITIN, EIN, Phone, DL

    def test_detect_locale(self, detector):
        assert detector.detect_locale("Codice Fiscale: RSSMRA85M01H501Z") == "IT"
        assert detector.detect_locale("CPF: 123.456.789-09") == "BR"

    def test_detect_report(self, detector):
        report = detector.detect("CURP: GARC850101HDFRNN09 CPF: 123.456.789-09")
        assert report.has_detections
        assert report.primary_locale in ("MX", "BR")


class TestRedactObjectI18n:
    def test_dict_with_locale(self, redactor):
        obj = {
            "name": "Maria",
            "cpf": "123.456.789-09",
            "normal": "nothing sensitive"
        }
        result = redactor.redact_object(obj)
        assert result["cpf"] == Redactor.PLACEHOLDER
        assert result["normal"] == "nothing sensitive"

    def test_nested_dict(self, redactor):
        obj = {
            "user": {
                "name": "Hans",
                "steuer_id": "12345678901"
            }
        }
        result = redactor.redact_object(obj)
        # Steuer-ID gets caught by generic SSN pattern in base
        assert result["user"]["name"] == "Hans"
