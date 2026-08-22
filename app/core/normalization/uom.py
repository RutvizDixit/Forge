import math
import re
from fractions import Fraction
from typing import Any, Dict, Optional, Tuple

import pandas as pd


class UnitNormalizer:
    """
    Normalizes common engineering units and technical values.

    The normalizer standardizes representation without inventing
    conversions that require assumptions about the source value.
    """

    UNIT_ALIASES: Dict[str, str] = {
        "inch": "in",
        "inches": "in",
        "in": "in",
        "in.": "in",
        '"': "in",
        "foot": "ft",
        "feet": "ft",
        "ft": "ft",
        "ft.": "ft",
        "millimeter": "mm",
        "millimeters": "mm",
        "millimetre": "mm",
        "millimetres": "mm",
        "mm": "mm",
        "centimeter": "cm",
        "centimeters": "cm",
        "centimetre": "cm",
        "centimetres": "cm",
        "cm": "cm",
        "meter": "m",
        "meters": "m",
        "metre": "m",
        "metres": "m",
        "m": "m",
        "millivolt": "mV",
        "millivolts": "mV",
        "mv": "mV",
        "volt": "V",
        "volts": "V",
        "v": "V",
        "amp": "A",
        "amps": "A",
        "ampere": "A",
        "amperes": "A",
        "a": "A",
        "milliamp": "mA",
        "milliamps": "mA",
        "milliampere": "mA",
        "milliamperes": "mA",
        "ma": "mA",
        "watt": "W",
        "watts": "W",
        "w": "W",
        "kilowatt": "kW",
        "kilowatts": "kW",
        "kw": "kW",
        "ohm": "Ω",
        "ohms": "Ω",
        "omega": "Ω",
        "Ω": "Ω",
        "kilohm": "kΩ",
        "kilohms": "kΩ",
        "kohm": "kΩ",
        "kohms": "kΩ",
        "kω": "kΩ",
        "megohm": "MΩ",
        "megohms": "MΩ",
        "mohm": "MΩ",
        "mohms": "MΩ",
        "mω": "MΩ",
        "hertz": "Hz",
        "hz": "Hz",
        "kilohertz": "kHz",
        "kilohertz": "kHz",
        "khz": "kHz",
        "megahertz": "MHz",
        "mhz": "MHz",
        "gigahertz": "GHz",
        "ghz": "GHz",
        "pascal": "Pa",
        "pascals": "Pa",
        "pa": "Pa",
        "kilopascal": "kPa",
        "kilopascals": "kPa",
        "kpa": "kPa",
        "megapascal": "MPa",
        "megapascals": "MPa",
        "mpa": "MPa",
        "psi": "psi",
        "pound per square inch": "psi",
        "pounds per square inch": "psi",
        "bar": "bar",
        "bars": "bar",
        "degree": "deg",
        "degrees": "deg",
        "°": "deg",
        "c": "°C",
        "°c": "°C",
        "celsius": "°C",
        "fahrenheit": "°F",
        "°f": "°F",
        "f": "°F",
        "kelvin": "K",
        "k": "K",
        "kilogram": "kg",
        "kilograms": "kg",
        "kg": "kg",
        "gram": "g",
        "grams": "g",
        "g": "g",
        "milligram": "mg",
        "milligrams": "mg",
        "mg": "mg",
        "pound": "lb",
        "pounds": "lb",
        "lb": "lb",
        "lbs": "lb",
        "ounce": "oz",
        "ounces": "oz",
        "oz": "oz",
        "liter": "L",
        "liters": "L",
        "litre": "L",
        "litres": "L",
        "l": "L",
        "milliliter": "mL",
        "milliliters": "mL",
        "millilitre": "mL",
        "millilitres": "mL",
        "ml": "mL",
        "gallon": "gal",
        "gallons": "gal",
        "gal": "gal",
        "minute": "min",
        "minutes": "min",
        "min": "min",
        "second": "s",
        "seconds": "s",
        "sec": "s",
        "s": "s",
        "hour": "h",
        "hours": "h",
        "hr": "h",
        "hrs": "h",
        "h": "h",
        "millisecond": "ms",
        "milliseconds": "ms",
        "ms": "ms",
        "percent": "%",
        "percentage": "%",
        "%": "%",
    }

    FRACTION_PATTERN = re.compile(
        r"(?P<whole>\d+)\s+(?P<num>\d+)\s*/\s*(?P<den>\d+)"
    )

    SIMPLE_FRACTION_PATTERN = re.compile(
        r"(?P<num>\d+)\s*/\s*(?P<den>\d+)"
    )

    RANGE_PATTERN = re.compile(
        r"(?P<left>-?\d+(?:\.\d+)?)\s*"
        r"(?P<separator>-|–|—|to)\s*"
        r"(?P<right>-?\d+(?:\.\d+)?)",
        flags=re.IGNORECASE,
    )

    def normalize_dataframe(
        self,
        dataframe: pd.DataFrame,
    ) -> pd.DataFrame:
        if not isinstance(dataframe, pd.DataFrame):
            raise TypeError("UnitNormalizer expects a pandas DataFrame.")

        working = dataframe.copy()

        for column in working.columns:
            working[column] = working[column].map(
                self.normalize_value
            )

        return working

    def normalize_record(
        self,
        record: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not isinstance(record, dict):
            raise TypeError("UnitNormalizer expects a dictionary record.")

        return {
            key: self.normalize_value(value)
            for key, value in record.items()
        }

    def normalize_value(self, value: Any) -> Any:
        if value is None:
            return ""

        if isinstance(value, float) and math.isnan(value):
            return ""

        if not isinstance(value, str):
            value = str(value)

        text = value.strip()

        if not text:
            return ""

        text = self._normalize_whitespace(text)
        text = self._normalize_fraction(text)
        text = self._normalize_ranges(text)
        text = self._normalize_units(text)
        text = self._normalize_numeric_spacing(text)

        return text.strip()

    def normalize_unit(self, unit: str) -> str:
        if unit is None:
            return ""

        normalized = str(unit).strip().lower()

        return self.UNIT_ALIASES.get(
            normalized,
            str(unit).strip(),
        )

    def extract_unit(
        self,
        value: Any,
    ) -> Optional[str]:
        if value is None:
            return None

        text = str(value).strip()

        if not text:
            return None

        ordered = sorted(
            self.UNIT_ALIASES.items(),
            key=lambda item: len(item[0]),
            reverse=True,
        )

        for alias, canonical in ordered:
            if alias in {'"', "°", "%", "Ω"}:
                pattern = re.escape(alias)
            else:
                pattern = rf"(?<![A-Za-z]){re.escape(alias)}(?![A-Za-z])"

            if re.search(pattern, text, flags=re.IGNORECASE):
                return canonical

        return None

    def parse_measurement(
        self,
        value: Any,
    ) -> Tuple[Optional[float], Optional[str]]:
        if value is None:
            return None, None

        normalized = self.normalize_value(value)

        if not normalized:
            return None, None

        unit = self.extract_unit(normalized)

        numeric_part = normalized

        if unit:
            numeric_part = re.sub(
                rf"\s*{re.escape(unit)}\s*$",
                "",
                numeric_part,
                flags=re.IGNORECASE,
            )

        numeric_part = numeric_part.strip()

        try:
            return float(numeric_part), unit
        except ValueError:
            return None, unit

    def _normalize_whitespace(self, text: str) -> str:
        text = text.replace("\u00a0", " ")
        text = text.replace("×", "x")
        text = text.replace("–", "-")
        text = text.replace("—", "-")

        return re.sub(r"\s+", " ", text).strip()

    def _normalize_fraction(self, text: str) -> str:
        def mixed(match):
            whole = int(match.group("whole"))
            numerator = int(match.group("num"))
            denominator = int(match.group("den"))

            if denominator == 0:
                return match.group(0)

            value = whole + (numerator / denominator)

            return self._format_number(value)

        text = self.FRACTION_PATTERN.sub(mixed, text)

        def simple(match):
            numerator = int(match.group("num"))
            denominator = int(match.group("den"))

            if denominator == 0:
                return match.group(0)

            value = numerator / denominator

            return self._format_number(value)

        text = self.SIMPLE_FRACTION_PATTERN.sub(
            simple,
            text,
        )

        return text

    def _normalize_ranges(self, text: str) -> str:
        def replace(match):
            left = self._format_number(
                float(match.group("left"))
            )

            right = self._format_number(
                float(match.group("right"))
            )

            return f"{left}-{right}"

        return self.RANGE_PATTERN.sub(replace, text)

    def _normalize_units(self, text: str) -> str:
        ordered = sorted(
            self.UNIT_ALIASES.items(),
            key=lambda item: len(item[0]),
            reverse=True,
        )

        for alias, canonical in ordered:
            if alias in {'"', "°", "%", "Ω"}:
                pattern = re.escape(alias)
            else:
                pattern = rf"(?<![A-Za-z]){re.escape(alias)}(?![A-Za-z])"

            text = re.sub(
                pattern,
                f" {canonical} ",
                text,
                flags=re.IGNORECASE,
            )

        return re.sub(r"\s+", " ", text).strip()

    def _normalize_numeric_spacing(self, text: str) -> str:
        text = re.sub(
            r"(?<=\d)\s+(?=\.)",
            "",
            text,
        )

        text = re.sub(
            r"(?<=\.)\s+(?=\d)",
            "",
            text,
        )

        return text

    @staticmethod
    def _format_number(value: float) -> str:
        if value.is_integer():
            return str(int(value))

        return f"{value:.6f}".rstrip("0").rstrip(".")