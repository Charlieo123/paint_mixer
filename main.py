from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from skimage import color
import colour
from scipy.optimize import minimize

app = Flask(__name__)
CORS(app)

# Define available colors with their RGBA values and lightfastness
available_colors = {
    'Black': {'rgba': (23, 23, 23, 1.0), 'lightfastness': 10},
    'Titanium White': {'rgba': (245, 245, 245, 1.0), 'lightfastness': 10},
    'Emerald Green': {'rgba': (6, 150, 76, 1.0), 'lightfastness': 7},
    'Lemon Yellow': {'rgba': (255, 255, 16, 1.0), 'lightfastness': 7},
    'Ultramarine': {'rgba': (4, 9, 119, 1.0), 'lightfastness': 10},
    'Phthalo Blue': {'rgba': (82, 116, 255, 1.0), 'lightfastness': 10},
    'Cerulean Blue': {'rgba': (0, 138, 248, 1.0), 'lightfastness': 10},
    'Cobalt Blue': {'rgba': (0, 87, 172, 1.0), 'lightfastness': 10},
    'Perm Blue Violet': {'rgba': (72, 11, 129, 1), 'lightfastness': 10},
    'Crimson Red': {'rgba': (255, 26, 26, 1), 'lightfastness': 7},
    'Carmine': {'rgba': (182, 0, 13, 1), 'lightfastness': 7},
    'Rose': {'rgba': (218, 58, 76, 1.0), 'lightfastness': 7},
    'Orange': {'rgba': (239, 118, 32, 1.0), 'lightfastness': 7},
    'Grey': {'rgba': (225, 209, 196, 1.0), 'lightfastness': 7},
    'Green Pale': {'rgba': (0, 145, 101, 1), 'lightfastness': 10},
    'Raw Umber': {'rgba': (92, 43, 10, 1), 'lightfastness': 10},
    'Yellow Ochre': {'rgba': (215, 160, 65, 1), 'lightfastness': 10},
    'Gold Ochre': {'rgba': (231, 144, 29, 1), 'lightfastness': 10},
    'Raw Sienna': {'rgba': (211, 138, 62, 1), 'lightfastness': 10},
    'Burnt Sienna': {'rgba': (200, 98, 53, 1), 'lightfastness': 10},
    'Naples Yellow': {'rgba': (245, 222, 81, 1), 'lightfastness': 10},
    'Cadmium Yellow': {'rgba': (246, 210, 5, 1), 'lightfastness': 7},
    'Burnt Umber': {'rgba': (50, 23, 0, 1.0), 'lightfastness': 10},
    'Vermilion': {'rgba': (244, 29, 4, 1), 'lightfastness': 7},
    'Viridian': {'rgba': (8, 54, 57, 1), 'lightfastness': 10},
    'Fluorescent Peach Red': {'rgba': (255, 112, 177, 1), 'lightfastness': 10},
}

# Precompute LAB values for all available colors
def initialize_color_data():
    for color_name, color_data in available_colors.items():
        rgba = color_data['rgba']
        lab = rgba_to_lab(rgba)
        available_colors[color_name]['lab'] = lab

def rgba_to_lab(rgba):
    """Convert RGBA color to LAB color space."""
    rgb = np.array(rgba[:3]) / 255.0
    lab = color.rgb2lab(rgb[np.newaxis, np.newaxis, :])
    return lab[0, 0, :]

def srgb_to_linear(srgb):
    srgb = srgb / 255.0
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    return linear

def linear_to_srgb(linear):
    srgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055)
    return srgb * 255.0


def color_distance(lab_alpha1, lab_alpha2):
    """Calculate color distance between two LAB colors, including alpha."""
    lab1, alpha1 = lab_alpha1[:3], lab_alpha1[3]
    lab2, alpha2 = lab_alpha2[:3], lab_alpha2[3]
    delta_e = colour.delta_E(lab1, lab2, method='CIE 2000')
    delta_alpha = abs(alpha1 - alpha2)
    total_distance = delta_e + delta_alpha
    return total_distance

def find_closest_color(target_lab, exclude_colors=None):
    """Find the closest color in available_colors to the target_lab."""
    if exclude_colors is None:
        exclude_colors = []
    filtered_colors = {
        name: data for name, data in available_colors.items() if name not in exclude_colors
    }
    closest_color = min(
        filtered_colors,
        key=lambda name: color_distance(
            np.append(filtered_colors[name]['lab'], filtered_colors[name]['rgba'][3]),
            target_lab,
        ),
    )
    return closest_color

def adjust_lightness(lab_alpha, lighten=True, factor=0.1):
    """Adjust the lightness of a LAB color."""
    L, a, b, alpha = lab_alpha
    if lighten:
        L = min(100, L + factor * (100 - L))
    else:
        L = max(0, L - factor * L)
    return np.array([L, a, b, alpha])

def blend_over_white(rgba):
    """Blend an RGBA color over a white background."""
    r, g, b, a = rgba
    a = np.clip(a, 0, 1)
    foreground = np.array([r, g, b], dtype=float) * a
    background = np.array([255, 255, 255], dtype=float) * (1 - a)
    blended_rgb = foreground + background
    blended_rgb = np.clip(blended_rgb, 0, 255)
    return blended_rgb.astype(int)

def parse_rgba_string(rgba_str):
    rgba_values = rgba_str.replace('rgba(', '').replace(')', '').split(',')
    return tuple(int(v) if i < 3 else float(v) for i, v in enumerate(rgba_values))

def calculate_mixed_color(mix_ratios):
    """Calculate the mixed RGBA color based on mix ratios."""
    total_ratio = sum(mix_ratios.values())
    if total_ratio == 0:
        return (0, 0, 0, 0)

    normalized_ratios = {color: ratio / total_ratio for color, ratio in mix_ratios.items()}
    ratios = np.array(list(normalized_ratios.values()))
    colors_rgba = np.array([available_colors[color]['rgba'] for color in normalized_ratios.keys()])


    # Subtractive mixing in CMY space
    # colors_cmy = 1 - colors_rgba[:, :3] / 255.0
    # mixed_cmy = np.prod(colors_cmy ** ratios[:, np.newaxis], axis=0)
    # mixed_rgb = (1 - mixed_cmy) * 255
    # mixed_rgb = np.clip(mixed_rgb, 0, 255).astype(int)
    colors_linear_rgb = np.array([srgb_to_linear(colors_rgba[i, :3]) for i in range(len(colors_rgba))])

    # Mix colors in linear RGB space
    mixed_linear_rgb = np.sum(colors_linear_rgb.T * ratios, axis=1)

    # Convert back to sRGB
    mixed_rgb = linear_to_srgb(mixed_linear_rgb)
    mixed_rgb = np.clip(mixed_rgb, 0, 255).astype(int)

    # Mix alpha values
    alphas = colors_rgba[:, 3]
    mixed_alpha = np.dot(alphas, ratios)
    mixed_alpha = np.clip(mixed_alpha, 0, 1.0)

    return tuple(mixed_rgb.tolist() + [round(mixed_alpha, 2)])

def select_paints(target_lab_alpha, max_paints=4, base_threshold=7):
    distances = {}
    for color_name, color_data in available_colors.items():
        color_lab_alpha = np.append(color_data['lab'], color_data['rgba'][3])
        dist = color_distance(color_lab_alpha, target_lab_alpha)
        distances[color_name] = dist

    sorted_paints = sorted(distances.items(), key=lambda x: x[1])
    selected_paints = [sorted_paints[0][0]]
    current_distance = sorted_paints[0][1]
    threshold = base_threshold + current_distance * 1.1

    for color_name, dist in sorted_paints[1:]:
        weight_factor = 1 + 0.05 * (len(selected_paints) - 1)
        adjusted_distance = dist * weight_factor
        if adjusted_distance <= threshold and len(selected_paints) < max_paints:
            selected_paints.append(color_name)
        if len(selected_paints) >= max_paints:
            break

    if len(selected_paints) == 1:
        selected_paints.append(sorted_paints[1][0])

    return selected_paints

def compute_color_differences(target_rgb, selected_paints):
    """Compute color differences between target RGB and selected paints."""
    color_differences = {}
    for color in selected_paints:
        paint_rgb = np.array(available_colors[color]['rgba'][:3])
        diff = np.linalg.norm(paint_rgb - target_rgb)
        color_differences[color] = diff
    return color_differences

def compute_maximum_ratios(color_differences):
    """Compute maximum ratios for each paint based on color differences."""
    diffs = np.array(list(color_differences.values()))
    diffs = np.maximum(diffs, 1e-6)
    inv_diffs = 1 / diffs
    inv_diffs /= inv_diffs.sum()
    min_max_ratio = 0.05
    max_ratios = min_max_ratio + inv_diffs * (1 - min_max_ratio)
    max_ratios_dict = {
        color: max_ratios[i] for i, color in enumerate(color_differences.keys())
    }
    return max_ratios_dict

def optimize_mixing_ratios(target_lab_alpha, selected_paints):
    target_rgb = color.lab2rgb(target_lab_alpha[:3][np.newaxis, np.newaxis, :])[0, 0, :] * 255
    color_differences = compute_color_differences(target_rgb, selected_paints)
    max_ratios_dict = compute_maximum_ratios(color_differences)

    def objective(ratios):
        colors_rgba = np.array([available_colors[color]['rgba'] for color in selected_paints])
        colors_rgb = colors_rgba[:, :3] / 255.0
        alphas = colors_rgba[:, 3]
        # colors_cmy = 1 - colors_rgba[:, :3] / 255.0
        # mixed_cmy = np.prod(colors_cmy ** ratios[:, np.newaxis], axis=0)
        # mixed_rgb = (1 - mixed_cmy) * 255
        colors_linear_rgb = np.array([srgb_to_linear(colors_rgba[i, :3]) for i in range(len(colors_rgba))])

        # Mix colors in linear RGB space
        mixed_linear_rgb = np.sum(colors_linear_rgb.T * ratios, axis=1)

        # Convert back to sRGB
        mixed_rgb = linear_to_srgb(mixed_linear_rgb)
        mixed_rgb = np.clip(mixed_rgb, 0, 255).astype(int)
        mixed_alpha = np.dot(alphas, ratios)
        mixed_lab = color.rgb2lab(mixed_rgb[np.newaxis, np.newaxis, :])[0, 0, :]
        mixed_lab_alpha = np.append(mixed_lab, mixed_alpha)
        distance = color_distance(mixed_lab_alpha, target_lab_alpha)
        num_paints_used = np.count_nonzero(ratios > 0.01)
        penalty_per_paint = 1.0
        sparsity_penalty = penalty_per_paint * num_paints_used
        total_distance = distance + sparsity_penalty
        return total_distance

    max_ratios = np.array([max_ratios_dict[color] for color in selected_paints])
    initial_guess = max_ratios / max_ratios.sum()
    bounds = [(0, max_ratios_dict[color]) for color in selected_paints]
    constraints = {'type': 'eq', 'fun': lambda x: np.sum(x) - 1}
    result = minimize(
        objective, initial_guess, method='SLSQP', bounds=bounds, constraints=constraints
    )

    if result.success:
        ratios = result.x
        ratios = np.where(ratios < 0.01, 0, ratios)
        total = ratios.sum()
        if total > 0:
            ratios /= total
        mix_ratios = {
            color: round(ratios[i], 2)
            for i, color in enumerate(selected_paints) if ratios[i] > 0
        }
        return mix_ratios
    else:
        print("Optimization failed.")
        return None

def generate_mixes(target_rgba):
    output = {}
    blended_rgb = blend_over_white(target_rgba)
    target_rgb = blended_rgb / 255.0
    target_lab = color.rgb2lab(target_rgb[np.newaxis, np.newaxis, :])[0, 0, :]
    target_lab_alpha = np.append(target_lab, 1.0)

    # Generate Slightly Lighter Mix
    lighter_lab_alpha = adjust_lightness(target_lab_alpha, lighten=True, factor=0.05)
    selected_paints_lighter = select_paints(lighter_lab_alpha)
    lighter_mix_ratios = optimize_mixing_ratios(lighter_lab_alpha, selected_paints_lighter)
    lighter_mix = {
        'ratios': lighter_mix_ratios,
        'mixed_color': calculate_mixed_color(lighter_mix_ratios)
    }

    # Actual Mix
    selected_paints_actual = select_paints(target_lab_alpha)
    actual_mix_ratios = optimize_mixing_ratios(target_lab_alpha, selected_paints_actual)
    actual_mix = {
        'ratios': actual_mix_ratios,
        'mixed_color': calculate_mixed_color(actual_mix_ratios)
    }

    # Generate Slightly Darker Mix
    darker_lab_alpha = adjust_lightness(target_lab_alpha, lighten=False, factor=0.05)
    selected_paints_darker = select_paints(darker_lab_alpha)
    darker_mix_ratios = optimize_mixing_ratios(darker_lab_alpha, selected_paints_darker)
    darker_mix = {
        'ratios': darker_mix_ratios,
        'mixed_color': calculate_mixed_color(darker_mix_ratios)
    }

    output['lighter_mix'] = lighter_mix
    output['actual_mix'] = actual_mix
    output['darker_mix'] = darker_mix

    return output

@app.route('/post_colour', methods=['POST'])
def handle_colour_post():
    colour_data = request.json.get('colour')
    print(f"Received color: {colour_data}")
    rgba_tuple = parse_rgba_string(colour_data)
    result = generate_mixes(rgba_tuple)
    return jsonify({'status': 'success', **result})

if __name__ == '__main__':
    initialize_color_data()
    app.run(debug=True, host='0.0.0.0', port=8030)
